import { decideIcon } from "../src/lib/item-icon-rules";
const T: [string, string, string, string, string][] = [
  // name, category, brand, model, expected
  ["Dishwasher (i3)", "Appliance", "Siemens", "", "dishwasher"],
  ["Washing machine (i5)", "Appliance", "Siemens", "", "washer"],
  ["Heat-pump dryer", "Appliance", "Siemens", "", "dryer"],
  ["Oven", "Appliance", "Neff", "", "oven"],
  ["Induction stove", "Appliance", "Neff", "", "hob"],
  ["Robot vacuum", "Appliance", "Ecovacs", "Deebot N8 Pro", "robot"],
  ["Cordless vacuum", "Appliance", "Miele", "Cat & Dog HX1", "vacuum"],
  ["Corded vacuum", "Appliance", "Miele", "Cat & Dog", "vacuum"],
  ["Security cameras", "Smart home", "Eufy", "", "camera"],
  ["Impact drill", "Tool", "Bosch (Green)", "", "drill"],
  ["Rotary drill", "Tool", "Bosch (Green)", "", "drill"],
  ["Table saw", "Tool", "Bosch (Green)", "", "drill"],
  ["Rotary sander", "Tool", "Bosch (Green)", "", "drill"],
  ["Bicycle", "Bike & vehicle", "", "", "bike"],
  ["Kitchen knives", "Other", "", "", "knives"],
  ["Veera's bed", "Pet", "", "", "paw"],
  // tricky
  ["Kids bed", "Furniture", "", "", "bed"],
  ["Plant pot", "Garden", "", "", "plant"],
  ["Light switch", "Smart home", "", "", "light"],
  ["Nintendo Switch", "Electronics", "", "", "console"],
  ["Coffee machine", "Appliance", "", "", "coffee"],
  ["Cat tree", "Pet", "", "", "cat"],
  ["Dog bed", "Furniture", "", "", "dog"],
  ["Screwdriver set", "Tool", "", "", "hammer"],
  ["Hue bridge", "Smart home", "Philips", "", "wifi"],
  ["Mystery gadget", "Smart home", "Roborock", "S8", "robot"],
  ["Mystery gadget", "Smart home", "Sonos", "Era 100", "speaker"],
  ["Thing", "Furniture", "", "", "furniture"],
  ["Thing", "Other", "", "", "box"],
  ["Smart TV", "Electronics", "LG", "", "tv"],
  ["Recycle bin", "Other", "", "", "box"],
  ["Fish tank", "Pet", "", "", "fish"],
  ["Lawn mower", "Garden", "", "", "mower"],
  ["Smoke detector", "Smart home", "", "", "alarm"],
];
let bad = 0;
for (const [name, category, brand, model, want] of T) {
  const d = decideIcon({ name, category, brand, model });
  const ok = d.key === want; if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(22)} [${category}] -> ${d.key.padEnd(12)} ${d.source.padEnd(8)} ${d.why}${ok ? "" : "   (wanted " + want + ")"}`);
}
console.log(decideIcon({ name: "Oven", icon: "fridge" }, (k) => k === "fridge").source, "(override)");
console.log(decideIcon({ name: "Oven", icon: "gone" }, (k) => k === "fridge").key, "(unknown override falls back)");
if (bad) { console.error(`${bad} icon case(s) FAILED`); process.exit(1); }
console.log("icon cases: all pass");
