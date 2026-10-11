import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://www.aussiescodex.com/api/data/';
const OUT = new URL('../dist/orna-catalogs.json', import.meta.url);

async function getJson(name) {
  const response = await fetch(BASE + name);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
}

const [codex, translations, icons, spellIcons] = await Promise.all([
  getJson('codex.json'),
  getJson('translations.en.json'),
  getJson('icons.json'),
  getJson('spellsIcons.json')
]);

const words = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const number = value => {
  const match = String(value ?? '').replaceAll(',', '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
};
const displayElement = value => {
  if (!value) return '';
  const values = Array.isArray(value) ? value : [value];
  const joined = values.length > 2 && values.every(v => String(v).length === 1) ? values.join('') : values.join(', ');
  return words(joined);
};
const iconMap = new Map([...icons, ...spellIcons].map(x => [String(x.name || '').toLowerCase(), x.image]));
const imageFor = name => {
  const image = iconMap.get(String(name || '').toLowerCase());
  return image ? `https://playorna.com/static/img/${image}` : '';
};
const translated = id => translations.main?.[id] || {};
const relationNames = relations => (relations || []).map(([, id]) => translated(id).name || words(id));
const effectText = list => (list || []).map(x => `${words(x.name)}${x.chance ? ` ${x.chance}` : ''}`);

function powerParts(raw = '') {
  const normalized = String(raw).replaceAll(',', '');
  const range = normalized.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  const single = normalized.match(/-?\d+(?:\.\d+)?/);
  const hit = normalized.match(/[x×]\s*(\d+)/i);
  return {
    pmin: range ? Number(range[1]) : single ? Number(single[0]) : 0,
    pmax: range ? Number(range[2]) : single ? Number(single[0]) : 0,
    hits: hit ? Number(hit[1]) : 1
  };
}

function spellRecord([id, spell]) {
  const text = translated(id);
  const name = text.name || words(id);
  const description = text.description || '';
  const power = powerParts(spell.stats?.power);
  const learnedBy = relationNames(spell.learned_by);
  const gearSources = relationNames(spell['off-hands']);
  const causes = effectText(spell.causes);
  const gives = effectText(spell.gives);
  const cures = effectText(spell.cures);
  const requiresTurns = description.match(/requires\s+(\d+)\s+turn/i);
  const stat = /magic stat/i.test(description) ? 'MAG' : /attack stat/i.test(description) ? 'ATT' : spell.stats?.power ? 'MAG' : 'NONE';
  const notes = [
    description,
    causes.length ? `Causes: ${causes.join(', ')}.` : '',
    gives.length ? `Gives: ${gives.join(', ')}.` : '',
    cures.length ? `Cures: ${cures.join(', ')}.` : '',
    gearSources.length ? `Granted by gear: ${gearSources.join(', ')}.` : ''
  ].filter(Boolean).join(' ');
  return {
    id,
    name,
    tier: Number(spell.tier) || 1,
    type: spell.spell_type === 'skill' ? 'Skill' : 'Spell',
    element: displayElement(spell.stats?.element),
    mana: number(spell.stats?.costs),
    turns: requiresTurns ? Number(requiresTurns[1]) : 1,
    hits: power.hits,
    pmin: power.pmin,
    pmax: power.pmax,
    power: String(spell.stats?.power || ''),
    critChance: String(spell.stats?.crit_chance || ''),
    stat,
    targets: words(spell.targets),
    learnedBy,
    gearSources,
    notes,
    image: imageFor(name),
    url: `https://playorna.com/codex/spells/${id}/`
  };
}

const slotMap = { weapon: 'Weapon', 'off-hand': 'Off-hand', head: 'Head', torso: 'Torso', legs: 'Legs', accessory: 'Accessory' };
const coreStats = new Set(['hp', 'mana', 'attack', 'magic', 'defense', 'resistance', 'dexterity', 'ward', 'adornment_slots', 'hp_regen', 'defend_power', 'element']);

function gearRecord([id, item]) {
  if (!slotMap[item.place]) return null;
  const text = translated(id);
  const name = text.name || words(id);
  const stats = item.stats || {};
  const abilityId = item.ability?.[0] === 'spells' ? item.ability[1] : '';
  const abilityName = abilityId ? (translated(abilityId).name || words(abilityId)) : '';
  const extraStats = Object.entries(stats)
    .filter(([key]) => !coreStats.has(key))
    .map(([key, value]) => `${words(key)}: ${Array.isArray(value) ? value.join(', ') : value}`);
  const gives = effectText(item.gives), causes = effectText(item.causes), immunities = effectText(item.immunities), cures = effectText(item.cures);
  const notes = [
    text.description || '',
    abilityName ? `Grants ability: ${abilityName}.` : '',
    gives.length ? `Gives: ${gives.join(', ')}.` : '',
    causes.length ? `Causes: ${causes.join(', ')}.` : '',
    immunities.length ? `Immunities: ${immunities.join(', ')}.` : '',
    cures.length ? `Cures: ${cures.join(', ')}.` : '',
    extraStats.length ? extraStats.join(' · ') : ''
  ].filter(Boolean).join(' ');
  const droppedByBoss = (item.dropped_by || []).some(([category]) => category === 'bosses' || category === 'raids');
  return {
    id,
    name,
    slot: slotMap[item.place],
    tier: Number(item.tier) || 1,
    rarity: words(item.rarity || 'common'),
    useableBy: words(item.useable_by),
    weaponType: words(item.type),
    base: {
      hp: number(stats.hp),
      mana: number(stats.mana),
      att: number(stats.attack),
      mag: number(stats.magic),
      def: number(stats.defense),
      res: number(stats.resistance),
      dex: number(stats.dexterity),
      ward: number(stats.ward)
    },
    regen: number(stats.hp_regen),
    defend: number(stats.defend_power),
    slots: number(stats.adornment_slots),
    element: displayElement(stats.element),
    isBoss: droppedByBoss,
    isWeapon: item.place === 'weapon',
    abilityId,
    abilityName,
    notes,
    image: imageFor(name),
    url: `https://playorna.com/codex/items/${id}/`
  };
}

const abilities = Object.entries(codex.main.spells).map(spellRecord).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
const gear = Object.entries(codex.main.items).map(gearRecord).filter(Boolean).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
const classes = Object.entries(codex.main.classes).map(([id, characterClass]) => ({
  id,
  name: translated(id).name || words(id),
  description: translated(id).description || '',
  tier: Number(characterClass.tier) || 1,
  skillIds: (characterClass.skills || []).filter(([category]) => category === 'spells').map(([, skillId]) => skillId),
  passiveAbilities: (characterClass.abilities || []).map(ability => words(ability.name))
})).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: "Aussie's Codex structured dataset with official Orna Codex links",
    sourceUrl: 'https://www.aussiescodex.com/orna-gear-simulator',
    officialUrl: 'https://playorna.com/codex/'
  },
  abilities,
  gear,
  classes
};

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(OUT, JSON.stringify(payload));
console.log(`Wrote ${abilities.length} abilities, ${gear.length} equippable items, and ${classes.length} classes to ${OUT.pathname}`);
