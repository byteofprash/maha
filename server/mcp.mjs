// MCP server for AHAM, mounted at /mcp (Streamable HTTP, stateless).
// Tools call the same store functions as the REST API; every write is audited as actor "agent".
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import crypto from "node:crypto";
import { addInterval, today, ValidationError } from "./db.mjs";

const ACTOR = "agent";
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 11);
const dayMs = 86400000;
const diffDays = (a, b) => {
  const p = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(a) - p(b)) / dayMs);
};

const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: "text", text: msg }] });

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use yyyy-mm-dd");
const unit = z.enum(["day", "week", "month"]);

function build(store) {
  const server = new McpServer(
    { name: "aham", version: "0.1.0" },
    {
      instructions:
        "AHAM is a household care tracker: rooms, an inventory of items (appliances, tools, etc. with purchase/warranty info) " +
        "and rituals (recurring acts of care, called tasks in the tool names). Each ritual has a plant that thrives while it is tended; completing a ritual is 'tending to it'. Refer to rooms by name. Prefer searching before creating to avoid duplicates. " +
        "Dates are yyyy-mm-dd. Deleting is irreversible through this interface: always ask the user first and only pass confirm=true after they agree.",
    }
  );

  const state = () => store.getState() ?? { floors: [], rooms: [], items: [], tasks: [] };

  /** Accept a room id or (case-insensitive) name; null/undefined => no room. */
  const resolveRoom = (s, ref) => {
    if (ref == null || ref === "") return null;
    const r =
      s.rooms.find((x) => x.id === ref) ??
      s.rooms.filter((x) => x.name.toLowerCase() === ref.toLowerCase());
    const hit = Array.isArray(r) ? (r.length === 1 ? r[0] : null) : r;
    if (!hit) {
      const names = s.rooms.map((x) => x.name).join(", ") || "(none)";
      throw new ValidationError(
        Array.isArray(r) && r.length > 1 ? `Room name "${ref}" is ambiguous; use its id.` : `Unknown room "${ref}". Rooms: ${names}`
      );
    }
    return hit.id;
  };
  const resolveItem = (s, ref) => {
    if (ref == null || ref === "") return null;
    const hit = s.items.find((x) => x.id === ref);
    if (!hit) throw new ValidationError(`Unknown item id "${ref}". Use search_items to find the id.`);
    return hit.id;
  };

  const enrichItem = (s, i) => {
    const room = s.rooms.find((r) => r.id === i.roomId);
    const end = i.purchaseDate && i.warrantyMonths ? addInterval(i.purchaseDate, i.warrantyMonths, "month") : null;
    return {
      ...i,
      room: room?.name ?? null,
      warrantyEnds: end,
      warrantyStatus: end ? (diffDays(end, today()) >= 0 ? "active" : "expired") : "unknown",
    };
  };
  const enrichTask = (s, t) => {
    const room = s.rooms.find((r) => r.id === t.roomId);
    const item = s.items.find((i) => i.id === t.itemId);
    const d = diffDays(t.dueDate, today());
    return {
      ...t,
      history: t.history.slice(0, 5),
      room: room?.name ?? null,
      item: item?.name ?? null,
      daysUntilDue: d,
      status: d < 0 ? "overdue" : d === 0 ? "due today" : d <= 7 ? "due soon" : "later",
    };
  };

  const run = (fn) => async (args) => {
    try { return ok(await fn(args)); } catch (e) {
      if (e instanceof ValidationError) return fail(e.message);
      console.error("mcp tool error:", e);
      return fail("Internal error");
    }
  };
  const RO = { readOnlyHint: true, openWorldHint: false };
  const W = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
  const D = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

  // ---- read ----------------------------------------------------------------------
  server.registerTool("get_overview", {
    description: "Snapshot of the home: floors, rooms with item/task counts, overdue and upcoming tasks, warranties expiring within 90 days. Start here.",
    inputSchema: {},
    annotations: RO,
  }, run(() => {
    const s = state();
    const tasks = s.tasks.map((t) => enrichTask(s, t));
    const items = s.items.map((i) => enrichItem(s, i));
    return {
      today: today(),
      floors: s.floors,
      rooms: s.rooms.map((r) => ({
        id: r.id, name: r.name, floor: s.floors[r.floor] ?? r.floor,
        items: s.items.filter((i) => i.roomId === r.id).length,
        tasks: s.tasks.filter((t) => t.roomId === r.id).length,
      })),
      totals: { items: s.items.length, tasks: s.tasks.length },
      overdue: tasks.filter((t) => t.status === "overdue").map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, room: t.room })),
      dueNext7Days: tasks.filter((t) => t.daysUntilDue >= 0 && t.daysUntilDue <= 7).map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, room: t.room })),
      warrantiesEndingSoon: items
        .filter((i) => i.warrantyEnds && diffDays(i.warrantyEnds, today()) >= 0 && diffDays(i.warrantyEnds, today()) <= 90)
        .map((i) => ({ id: i.id, name: i.name, warrantyEnds: i.warrantyEnds, room: i.room })),
    };
  }));

  server.registerTool("search_items", {
    description: "List/search inventory items. All filters optional and combined with AND. Text matches name, brand, model, serial, store, notes and category.",
    inputSchema: {
      query: z.string().optional().describe("free text"),
      room: z.string().optional().describe("room name or id"),
      category: z.string().optional(),
      warranty: z.enum(["active", "expired", "unknown"]).optional(),
    },
    annotations: RO,
  }, run(({ query, room, category, warranty }) => {
    const s = state();
    const roomId = room ? resolveRoom(s, room) : null;
    const q = query?.toLowerCase();
    const items = s.items
      .map((i) => enrichItem(s, i))
      .filter((i) => (roomId ? i.roomId === roomId : true))
      .filter((i) => (category ? i.category.toLowerCase() === category.toLowerCase() : true))
      .filter((i) => (warranty ? i.warrantyStatus === warranty : true))
      .filter((i) => !q || [i.name, i.brand, i.model, i.serial, i.store, i.notes, i.category].some((f) => f.toLowerCase().includes(q)));
    return { count: items.length, items };
  }));

  server.registerTool("get_item", {
    description: "One item by id, with its linked tasks.",
    inputSchema: { id: z.string() },
    annotations: RO,
  }, run(({ id }) => {
    const s = state();
    const item = s.items.find((i) => i.id === id);
    if (!item) throw new ValidationError(`Item ${id} not found`);
    return { ...enrichItem(s, item), tasks: s.tasks.filter((t) => t.itemId === id).map((t) => enrichTask(s, t)) };
  }));

  server.registerTool("search_tasks", {
    description: "List/search maintenance tasks, soonest due first. Filters are combined with AND.",
    inputSchema: {
      query: z.string().optional().describe("free text in title, notes, category"),
      room: z.string().optional().describe("room name or id"),
      item_id: z.string().optional(),
      status: z.enum(["overdue", "due today", "due soon", "later"]).optional(),
      due_within_days: z.number().int().min(0).optional().describe("include tasks due in the next N days (and overdue)"),
    },
    annotations: RO,
  }, run(({ query, room, item_id, status, due_within_days }) => {
    const s = state();
    const roomId = room ? resolveRoom(s, room) : null;
    const q = query?.toLowerCase();
    const tasks = s.tasks
      .map((t) => enrichTask(s, t))
      .filter((t) => (roomId ? t.roomId === roomId : true))
      .filter((t) => (item_id ? t.itemId === item_id : true))
      .filter((t) => (status ? t.status === status : true))
      .filter((t) => (due_within_days != null ? t.daysUntilDue <= due_within_days : true))
      .filter((t) => !q || [t.title, t.notes, t.category].some((f) => f.toLowerCase().includes(q)))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { count: tasks.length, tasks };
  }));

  server.registerTool("list_completions", {
    description: "The log of everything that has been tended to, newest first, with when it happened. Filter by room, by ritual id, or from a date on.",
    inputSchema: {
      room: z.string().optional().describe("room name or id"),
      ritual_id: z.string().optional(),
      since: date.optional().describe("only entries on or after this date"),
      limit: z.number().int().min(1).max(200).optional().describe("default 50"),
    },
    annotations: RO,
  }, run(({ room, ritual_id, since, limit }) => {
    const s = state();
    const r = store.listCompletions({ roomId: room ? resolveRoom(s, room) : undefined, taskId: ritual_id, since, limit: limit ?? 50 });
    return {
      total: r.total,
      shown: r.completions.length,
      completions: r.completions.map((c) => ({ ritual: c.title, ritual_id: c.taskId, item: c.itemName, room: c.roomName, note: c.notes || undefined, tended_on: c.doneOn, recorded_at: c.at, by: c.actor })),
    };
  }));

  // ---- write: items ------------------------------------------------------------------
  const itemFields = {
    category: z.string().optional().describe("e.g. Appliance, Electronics, Smart home, Furniture, Tool, Bike & vehicle, Garden, Pet, Other"),
    room: z.string().nullable().optional().describe("room name or id; null to unassign"),
    brand: z.string().optional(), model: z.string().optional(), serial: z.string().optional(),
    purchase_date: date.nullable().optional(), store: z.string().optional(),
    price: z.number().min(0).nullable().optional(),
    warranty_months: z.number().int().min(0).nullable().optional(),
    manual_url: z.string().optional(), notes: z.string().optional(),
    icon: z.string().regex(/^[a-z0-9-]{0,30}$/).optional()
      .describe('optional icon key to override the automatic choice, e.g. "fridge", "vacuum", "drill", "bike", "plant", "paw"; "" restores automatic. Usually leave unset.'),
  };
  const toItem = (s, a) => ({
    ...(a.name !== undefined && { name: a.name }),
    ...(a.category !== undefined && { category: a.category }),
    ...(a.room !== undefined && { roomId: resolveRoom(s, a.room) }),
    ...(a.brand !== undefined && { brand: a.brand }),
    ...(a.model !== undefined && { model: a.model }),
    ...(a.serial !== undefined && { serial: a.serial }),
    ...(a.purchase_date !== undefined && { purchaseDate: a.purchase_date ?? "" }),
    ...(a.store !== undefined && { store: a.store }),
    ...(a.price !== undefined && { price: a.price }),
    ...(a.warranty_months !== undefined && { warrantyMonths: a.warranty_months }),
    ...(a.manual_url !== undefined && { manualUrl: a.manual_url }),
    ...(a.notes !== undefined && { notes: a.notes }),
    ...(a.icon !== undefined && { icon: a.icon }),
  });

  server.registerTool("add_item", {
    description: "Add an inventory item. Search first to avoid duplicates.",
    inputSchema: { name: z.string().min(1), ...itemFields },
    annotations: W,
  }, run((a) => {
    const s = state();
    const item = store.upsertItem({
      category: "Other", roomId: null, brand: "", model: "", serial: "", purchaseDate: "", store: "",
      price: null, warrantyMonths: null, manualUrl: "", notes: "", icon: "", ...toItem(s, a), id: newId(),
    }, ACTOR);
    return enrichItem(state(), item);
  }));

  server.registerTool("update_item", {
    description: "Update fields of an item. Only the fields you pass change.",
    inputSchema: { id: z.string(), name: z.string().min(1).optional(), ...itemFields },
    annotations: { ...W, idempotentHint: true },
  }, run(({ id, ...rest }) => {
    const s = state();
    const cur = s.items.find((i) => i.id === id);
    if (!cur) throw new ValidationError(`Item ${id} not found`);
    return enrichItem(state(), store.upsertItem({ ...cur, ...toItem(s, rest), id }, ACTOR));
  }));

  server.registerTool("delete_item", {
    description: "Permanently delete an item (linked tasks stay but lose the link). ASK THE USER FIRST; set confirm=true only after they agree.",
    inputSchema: { id: z.string(), confirm: z.boolean().describe("must be true") },
    annotations: D,
  }, run(({ id, confirm }) => {
    if (confirm !== true) throw new ValidationError("Not deleted: confirm must be true after the user agrees.");
    return { deleted: store.deleteItem(id, ACTOR) };
  }));

  // ---- write: tasks ------------------------------------------------------------------
  const taskFields = {
    every: z.number().int().min(1).optional().describe("repeat interval count"),
    unit: unit.optional(),
    due_date: date.optional().describe("next due date; defaults to today for new tasks"),
    room: z.string().nullable().optional().describe("room name or id"),
    item_id: z.string().nullable().optional().describe("link to an inventory item"),
    category: z.string().optional().describe("Cleaning, Plants, Pets, Bikes & tools, Appliances, Garden, Safety, Admin, Other"),
    notes: z.string().optional(),
  };
  const toTask = (s, a) => ({
    ...(a.title !== undefined && { title: a.title }),
    ...(a.every !== undefined && { every: a.every }),
    ...(a.unit !== undefined && { unit: a.unit }),
    ...(a.due_date !== undefined && { dueDate: a.due_date }),
    ...(a.room !== undefined && { roomId: resolveRoom(s, a.room) }),
    ...(a.item_id !== undefined && { itemId: resolveItem(s, a.item_id) }),
    ...(a.category !== undefined && { category: a.category }),
    ...(a.notes !== undefined && { notes: a.notes }),
  });

  server.registerTool("add_task", {
    description: "Create a ritual: a recurring act of care (e.g. every 3 months). It is given a plant automatically.",
    inputSchema: { title: z.string().min(1), ...taskFields },
    annotations: W,
  }, run((a) => {
    const s = state();
    const t = store.upsertTask({
      every: 1, unit: "month", dueDate: today(), lastDone: null, roomId: null, itemId: null, category: "Other", notes: "",
      ...toTask(s, a), id: newId(),
    }, ACTOR);
    return enrichTask(state(), t);
  }));

  server.registerTool("update_task", {
    description: "Update fields of a task. Only the fields you pass change. To mark it done use complete_task instead.",
    inputSchema: { id: z.string(), title: z.string().min(1).optional(), ...taskFields },
    annotations: { ...W, idempotentHint: true },
  }, run(({ id, ...rest }) => {
    const s = state();
    const cur = s.tasks.find((t) => t.id === id);
    if (!cur) throw new ValidationError(`Task ${id} not found`);
    return enrichTask(state(), store.upsertTask({ ...cur, ...toTask(s, rest), id }, ACTOR));
  }));

  server.registerTool("complete_task", {
    description: "Mark a ritual as tended to (default today). Records it in the history and schedules the next one from the interval.",
    inputSchema: { id: z.string(), date: date.optional().describe("completion date, default today") },
    annotations: W,
  }, run(({ id, date: on }) => {
    const t = store.completeTask(id, on ?? today(), ACTOR);
    if (!t) throw new ValidationError(`Task ${id} not found`);
    return enrichTask(state(), t);
  }));

  server.registerTool("delete_task", {
    description: "Permanently delete a task and its history. ASK THE USER FIRST; set confirm=true only after they agree.",
    inputSchema: { id: z.string(), confirm: z.boolean().describe("must be true") },
    annotations: D,
  }, run(({ id, confirm }) => {
    if (confirm !== true) throw new ValidationError("Not deleted: confirm must be true after the user agrees.");
    return { deleted: store.deleteTask(id, ACTOR) };
  }));

  return server;
}

export function mountMcp(app, store) {
  const handler = async (req, res) => {
    const server = build(store);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); // stateless
    res.on("close", () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error("mcp error:", e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  };
  app.post("/mcp", handler);
  const no = (_req, res) =>
    res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)" }, id: null });
  app.get("/mcp", no);
  app.delete("/mcp", no);
}
