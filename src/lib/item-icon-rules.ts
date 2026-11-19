// The "which icon is this thing?" decision model. Pure and dependency-free so it is easy to test and reason about.
//
// Order of authority (first hit wins):
//   1. override  - the person (or the agent) picked an icon on the item
//   2. name      - ordered keyword rules over the item's name, most specific first
//   3. model     - a few brand / product-line words (e.g. "Deebot" => robot vacuum) when the name says nothing
//   4. category  - a sensible icon for the item's category
//   5. default   - a plain box
// Every decision carries a short "why" so the UI can explain itself.

export type IconKey =
  | "fridge" | "freezer" | "oven" | "hob" | "microwave" | "dishwasher" | "coffee" | "smallkitchen" | "knives"
  | "washer" | "dryer" | "iron"
  | "vacuum" | "robot" | "airpurifier"
  | "heating" | "cooling" | "thermostat" | "water" | "shower" | "bath" | "toilet"
  | "light" | "lamp" | "camera" | "doorbell" | "lock" | "alarm" | "wifi" | "solar" | "battery"
  | "tv" | "speaker" | "laptop" | "monitor" | "phone" | "tablet" | "printer" | "headphones" | "console" | "watch"
  | "drill" | "hammer" | "ladder"
  | "bike" | "car"
  | "plant" | "tree" | "mower" | "grill"
  | "dog" | "cat" | "fish" | "bird" | "paw"
  | "sofa" | "bed" | "chair" | "storage" | "curtains" | "safe"
  | "appliance" | "electronics" | "smarthome" | "furniture" | "tool" | "garden" | "box";

export type IconSource = "override" | "name" | "model" | "category" | "default";
export type IconDecision = { key: IconKey; source: IconSource; why: string };

type Rule = { re: RegExp; key: IconKey; category?: string };

/** Most specific first: "dishwasher" before "washer", "robot vacuum" before "vacuum", "dryer" before "heat pump". */
const NAME_RULES: Rule[] = [
  // animals first, so "cat tree" or "dog bed" are not read as furniture
  { re: /\b(dog|puppy|kennel)\b/, key: "dog" },
  { re: /\b(cat|kitten|litter)\b/, key: "cat" },
  { re: /\b(fish|aquarium|tank)\b/, key: "fish", category: "Pet" },
  { re: /\b(bird|parrot|cage)\b/, key: "bird", category: "Pet" },
  { re: /./, key: "paw", category: "Pet" }, // anything else a pet owns: beds, bowls, toys

  // kitchen
  { re: /\bdish\s?washer\b/, key: "dishwasher" },
  { re: /\b(fridge|refrigerator)\b/, key: "fridge" },
  { re: /\bfreezer\b/, key: "freezer" },
  { re: /\b(hob|cooktop|induction|stove|cooker|burner)\b/, key: "hob" },
  { re: /\b(oven)\b/, key: "oven" },
  { re: /\bmicrowave\b/, key: "microwave" },
  { re: /\b(coffee|espresso|kettle|nespresso)\b/, key: "coffee" },
  { re: /\b(toaster|blender|mixer|air\s?fryer|rice cooker|food processor|juicer)\b/, key: "smallkitchen" },
  { re: /\b(knife|knives|cutlery|cookware|saucepan|frying pan|cast iron)\b/, key: "knives" },

  // laundry (before heating: "heat-pump dryer")
  { re: /\b(washing machine|washer)\b/, key: "washer" },
  { re: /\b(tumble\s?)?dryer\b/, key: "dryer" },
  { re: /\b(iron|steamer)\b/, key: "iron" },

  // cleaning (robot before plain vacuum)
  { re: /\b(robot|robotic)\s+(vacuum|mop|cleaner|hoover)|\b(vacuum|mop)\s+robot\b|\b(roomba|deebot|roborock)\b/, key: "robot" },
  { re: /\b(vacuum|hoover)\b/, key: "vacuum" },
  { re: /\b(air purifier|humidifier|dehumidifier)\b/, key: "airpurifier" },

  // climate & water
  { re: /\b(thermostat)\b/, key: "thermostat" },
  { re: /\b(air\s?con|a\/c|ac unit|split unit|cooler)\b/, key: "cooling" },
  { re: /\b(boiler|heater|heat[- ]?pump|radiator|furnace|fireplace|heating|stove)\b/, key: "heating" },
  { re: /\b(water heater|softener|tap|faucet|hose|sprinkler|water)\b/, key: "water" },
  { re: /\bshower\b/, key: "shower" },
  { re: /\b(bath|bathtub|tub)\b/, key: "bath" },
  { re: /\b(toilet|wc)\b/, key: "toilet" },

  // smart home & security
  { re: /\b(camera|cameras|cctv|webcam)\b/, key: "camera" },
  { re: /\bdoorbell\b/, key: "doorbell" },
  { re: /\b(lock|deadbolt|keypad)\b/, key: "lock" },
  { re: /\b(smoke|carbon monoxide|co2? detector|alarm|detector|siren)\b/, key: "alarm" },
  { re: /\b(router|wifi|wi-fi|mesh|modem|access point|network switch|hub|bridge)\b/, key: "wifi" },
  { re: /\b(solar|inverter)\b/, key: "solar" },
  { re: /\b(battery|batteries|ups|powerbank|power station)\b/, key: "battery" },
  { re: /\b(lamp|floor light|desk light)\b/, key: "lamp" },
  { re: /\b(light|lights|bulb|bulbs|led|hue|lighting)\b/, key: "light" },

  // electronics
  { re: /\b(tv|television|projector)\b/, key: "tv" },
  { re: /\b(speaker|soundbar|sonos|stereo|radio|hifi)\b/, key: "speaker" },
  { re: /\b(laptop|macbook|notebook|computer|pc|desktop)\b/, key: "laptop" },
  { re: /\b(monitor|display|screen)\b/, key: "monitor" },
  { re: /\b(phone|iphone|smartphone|mobile)\b/, key: "phone" },
  { re: /\b(tablet|ipad|e-?reader|kindle)\b/, key: "tablet" },
  { re: /\bprinter|scanner\b/, key: "printer" },
  { re: /\b(headphones|earbuds|airpods|headset)\b/, key: "headphones" },
  { re: /\b(console|playstation|ps[45]|xbox|switch|gamepad|controller)\b/, key: "console" },
  { re: /\b(watch|smartwatch|fitbit)\b/, key: "watch" },

  // tools & wheels (saws and sanders are "power tools": the drill stands in for them)
  { re: /\b(drill|driver|saw|sander|grinder|jigsaw|planer|power tool)\b/, key: "drill" },
  { re: /\b(hammer|wrench|spanner|screwdriver|pliers|toolbox|tool box|mallet|chisel)\b/, key: "hammer" },
  { re: /\b(ladder|stepladder)\b/, key: "ladder" },
  { re: /\b(bike|bicycle|e-?bike|scooter|cargo bike|cycle)\b/, key: "bike" },
  { re: /\b(car|van|vehicle|motorbike|motorcycle)\b/, key: "car" },

  // garden
  { re: /\b(mower|lawnmower|trimmer|strimmer|hedge|leaf blower|chainsaw)\b/, key: "mower" },
  { re: /\b(bbq|barbecue|grill|smoker)\b/, key: "grill" },
  { re: /\b(tree|hedge|orchard)\b/, key: "tree" },
  { re: /\b(plant|plants|planter|flower|herb|herbs|garden|greenhouse|compost)\b/, key: "plant" },

  // furniture
  { re: /\b(sofa|couch|settee|loveseat)\b/, key: "sofa" },
  { re: /\b(bed|mattress|crib|cot)\b/, key: "bed" },
  { re: /\b(chair|armchair|stool|bench)\b/, key: "chair" },
  { re: /\b(wardrobe|cabinet|shelf|shelves|bookcase|drawer|dresser|cupboard|sideboard|closet)\b/, key: "storage" },
  { re: /\b(curtain|curtains|blind|blinds|shutter|shutters)\b/, key: "curtains" },
  { re: /\b(safe|vault)\b/, key: "safe" },
];

/** Brand / product-line words that identify the product when the name is vague ("Eufy cam", "Deebot N8"). */
const MODEL_RULES: Rule[] = [
  { re: /\b(deebot|roomba|roborock|dreame|narwal|eufy\s?clean)\b/, key: "robot" },
  { re: /\b(eufycam|eufy cam|ring|arlo|reolink|wyze cam|nest cam)\b/, key: "camera" },
  { re: /\b(sonos|bose|marshall)\b/, key: "speaker" },
  { re: /\b(hue|nanoleaf|lifx)\b/, key: "light" },
  { re: /\b(nest thermostat|tado|ecobee)\b/, key: "thermostat" },
  { re: /\b(airpods|wh-1000|quietcomfort)\b/, key: "headphones" },
  { re: /\b(unifi|ubiquiti|fritz|orbi|eero|tp-link deco)\b/, key: "wifi" },
];

const CATEGORY_ICON: Record<string, IconKey> = {
  Appliance: "appliance",
  Electronics: "electronics",
  "Smart home": "smarthome",
  Furniture: "furniture",
  Tool: "tool",
  "Bike & vehicle": "bike",
  Garden: "garden",
  Pet: "paw",
};

type Thing = { name: string; category?: string; brand?: string; model?: string; icon?: string };

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[’']/g, "'").trim();

export function decideIcon(item: Thing, known?: (k: string) => boolean): IconDecision {
  // 1. someone chose it (an unknown / retired key quietly falls through to the automatic choice)
  if (item.icon && (!known || known(item.icon))) {
    return { key: item.icon as IconKey, source: "override", why: "chosen by you" };
  }

  const category = item.category ?? "Other";
  const name = norm(item.name);

  // 2. the name
  for (const r of NAME_RULES) {
    if (r.category && r.category !== category) continue;
    const m = name.match(r.re);
    if (m) return { key: r.key, source: "name", why: r.re.source === "." ? `it's a ${category.toLowerCase()} item` : `“${m[0].trim()}” in the name` };
  }

  // 3. brand + model
  const bm = `${norm(item.brand)} ${norm(item.model)}`.trim();
  if (bm) {
    for (const r of MODEL_RULES) {
      const m = bm.match(r.re);
      if (m) return { key: r.key, source: "model", why: `“${m[0]}” in the brand / model` };
    }
  }

  // 4. the category
  const c = CATEGORY_ICON[category];
  if (c) return { key: c, source: "category", why: `a ${category.toLowerCase()} item` };

  return { key: "box", source: "default", why: "no clue yet" };
}
