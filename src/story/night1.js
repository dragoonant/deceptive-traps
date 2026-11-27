// Night 1: "The First Night". Pure data: cutscenes, dialogue, waves and notes.
// Dialogue lines are { who, text }; speakers are defined in portraits.js.

const S = { x: 0, z: 1 };
const W = { x: -1, z: 0 };

export const NIGHT1 = {
  id: 1,
  title: 'The First Night',
  startingCogs: 250,

  intro: {
    title: 'Night One · <em>The First Night</em>',
    panels: [
      {
        scene: 'manorOnMoor',
        caption: 'Brassmoor stands alone on the moor. Its master, Lysander Corvel, has been gone for seven years.',
      },
      { scene: 'wrenAndIndenture', caption: 'Wren keeps the house, as the indenture says. For as long as the house keeps time.' },
      { scene: 'lanternsOnRoad', caption: 'Tonight, there are lanterns on the moor road.' },
      { scene: 'houseWakes', caption: 'And somewhere in the walls, the house begins to tick.' },
    ],
  },

  opening: [
    { who: 'house', text: 'Wren. Wake up. We have visitors.' },
    { who: 'wren', text: 'At this hour? Nobody visits Brassmoor.' },
    { who: 'house', text: 'Nobody polite. Three lanterns on the road, and not one of them knocked.' },
    { who: 'wren', text: "You know I can't fight them." },
    { who: 'house', text: "You don't have to. You never have. That's what I'm for." },
    { who: 'house', text: 'Walk the halls. Pick a trap, aim at a tile, set it. The cogs are yours to spend.' },
    { who: 'house', text: "When you're ready, start the night. Then keep moving." },
  ],

  waves: [
    {
      spacing: 2.5,
      intruders: [
        ['thief', 'north'],
        ['thief', 'north'],
      ],
      onStart: [
        { who: 'pell', text: "Told you, Marrow. Old Corvel's place. Gold doorknobs, the lot of it." },
        { who: 'marrow', text: "Then why's it ticking?" },
        { who: 'house', text: "When a trap's lamp glows green, someone is standing in it. Fire it: floor, wall or ceiling." },
      ],
      onClear: [
        { who: 'house', text: 'Two down. Both still breathing, more or less.' },
        { who: 'wren', text: "They'll be back." },
        { who: 'house', text: "Their friends are already here. Spend the cogs they dropped. And read anything you find pinned to the walls." },
      ],
    },
    {
      spacing: 2,
      intruders: [
        ['thief', 'north'],
        ['thief', 'east'],
        ['thief', 'north'],
      ],
      onStart: [
        { who: 'dunne', text: 'Rook says there are two doors. You take the Gallery.' },
        { who: 'house', text: "They're splitting up. The east door opens into the Gallery. Mind your back." },
      ],
      onClear: [
        { who: 'wren', text: "That one's crowbar had Corvel's name scratched into it." },
        { who: 'house', text: 'Mm. A lot of people think they have a claim on him.' },
      ],
    },
    {
      spacing: 2.5,
      intruders: [
        ['rook', 'north'],
        ['thief', 'east'],
        ['thief', 'north'],
      ],
      onSpawn: {
        rook: [
          { who: 'rook', text: "Evening, little Keeper. Jessamy Rook. You've been hurting my people." },
          { who: 'wren', text: 'They came in through the windows.' },
          { who: 'rook', text: "And I'll leave through the front door, with whatever makes this place tick." },
          { who: 'house', text: "She's quicker than the others. Pin her down, then drop something heavy." },
        ],
      },
      onClear: [
        { who: 'wren', text: "Rook's crew is dragging her off across the moor." },
        { who: 'house', text: "Good. Don't relax. Someone else is at the north door, and they're wearing armour." },
      ],
    },
    {
      spacing: 3,
      intruders: [
        ['garrick', 'north'],
        ['knight', 'east'],
        ['thief', 'north'],
      ],
      onSpawn: {
        garrick: [
          { who: 'garrick', text: 'Halt! Sir Oswin Garrick, Knight-Collector of the Gearwright Guild.' },
          { who: 'garrick', text: 'I am here to inspect this property on behalf of its lawful creditors.' },
          { who: 'wren', text: 'At three in the morning?' },
          { who: 'garrick', text: 'The Guild never sleeps, madam. Neither, it seems, does your house.' },
          { who: 'house', text: 'He is heavy. Knockback barely moves him. Clamps and ceilings, Wren.' },
        ],
      },
    },
  ],

  outro: {
    title: 'Dawn',
    panels: [
      { scene: 'dawnRetreat', caption: "By dawn, Rook's crew was limping home across the moor with nothing to show but bruises." },
      { scene: 'garrickWrit', caption: 'Sir Oswin, on the other hand, had come prepared. He nailed something to the door.' },
    ],
  },

  closing: [
    { who: 'garrick', text: 'Bruised, madam, but not beaten. Read it. Brassmoor and its engine are forfeit to the Guild.' },
    { who: 'wren', text: 'Corvel never owed you anything.' },
    { who: 'garrick', text: 'Then let him come and say so himself. Good morning.' },
    { who: 'wren', text: "You've gone quiet." },
    { who: 'house', text: "Get some sleep, Wren. They'll be back tomorrow night. All of them." },
  ],

  next: { title: 'Night Two · The Writ', blurb: 'The Guild returns in force, and Rook has a new employer.' },

  notes: [
    {
      id: 'indenture',
      i: 14,
      j: 8,
      side: S,
      title: "The Keeper's Indenture",
      body:
        'I, Wren, of no other name, bind myself as Keeper of Brassmoor: to tend its rooms, wind its clocks and keep its doors, for as long as the house keeps time.\nIn return, the house shall keep the Keeper.\nWitnessed and sealed, L. Corvel.',
    },
    {
      id: 'worklog',
      i: 3,
      j: 7,
      side: S,
      title: 'Work log, day 1,204',
      body:
        "The Heartspring holds at full wind.\nW.'s fever broke at four this morning. The second spring took.\nShe asks why her chest ticks when she runs. I told her it is the house. It is not entirely a lie.\nL.C.",
    },
    {
      id: 'guildletter',
      i: 20,
      j: 2,
      side: W,
      title: 'Letter from the Gearwright Guild',
      body:
        'To Mr L. Corvel, or his heirs and mechanisms.\nYour licence dues on the device known as the Heartspring are seven years in arrears.\nFailing payment, the Guild will take possession of the premises and all engines therein.\nA. Fell, Guildmaster',
    },
  ],
};

export const NIGHTS = [NIGHT1];
