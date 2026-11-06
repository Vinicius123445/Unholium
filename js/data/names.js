'use strict';
// Name pools for randomly generated NPC names (rolled once per playthrough, saved with the game).
// Replace or extend these lists to match the setting.

G.NAMES = {
  female: ['Ada', 'Alma', 'Ava', 'Bea', 'Cara', 'Clara', 'Dora', 'Edith', 'Elena', 'Elsa', 'Erin', 'Eva', 'Faye', 'Freya',
    'Gemma', 'Greta', 'Hana', 'Hazel', 'Ida', 'Iris', 'Ivy', 'Jade', 'June', 'Kara', 'Lena', 'Lila', 'Lucy', 'Mara', 'Maya',
    'Mia', 'Nadia', 'Nina', 'Nora', 'Olga', 'Opal', 'Petra', 'Rosa', 'Ruby', 'Ruth', 'Sara', 'Selma', 'Tess', 'Una', 'Vera',
    'Viola', 'Wren', 'Yara', 'Zoe'],
  male: ['Abel', 'Alec', 'Amos', 'Arlo', 'Axel', 'Basil', 'Bruno', 'Caleb', 'Cyrus', 'Dario', 'Dean', 'Eli', 'Emil', 'Ezra',
    'Felix', 'Finn', 'Gabe', 'Gus', 'Hank', 'Hugo', 'Ivan', 'Jack', 'Jonas', 'Karl', 'Leo', 'Levi', 'Luca', 'Marco', 'Milo',
    'Nico', 'Noel', 'Oscar', 'Otto', 'Pablo', 'Quinn', 'Rafe', 'Reid', 'Rex', 'Rocco', 'Saul', 'Silas', 'Theo', 'Tobias',
    'Victor', 'Wade', 'Walt', 'Yuri', 'Zane'],
  last: ['Abbot', 'Alder', 'Ashby', 'Barlow', 'Bishop', 'Blake', 'Booker', 'Briggs', 'Carver', 'Cole', 'Crane', 'Dale',
    'Doyle', 'Drake', 'Ellis', 'Faber', 'Fenn', 'Fisher', 'Flint', 'Ford', 'Frost', 'Garrow', 'Grey', 'Hale', 'Harlow',
    'Hayes', 'Holt', 'Hunt', 'Ives', 'Keane', 'Kemp', 'Lang', 'Lowe', 'Marsh', 'Mercer', 'Moss', 'Nash', 'Oakes', 'Pike',
    'Price', 'Quill', 'Reyes', 'Rook', 'Royce', 'Sloane', 'Stone', 'Stroud', 'Swift', 'Thorne', 'Vance', 'Wade', 'Webb',
    'Wilde', 'York'],
  // street names for gang members and punks
  street: ['Ace', 'Blade', 'Bones', 'Brick', 'Chains', 'Dice', 'Fang', 'Ghost', 'Jinx', 'Knuckles', 'Lucky', 'Mad Dog',
    'Nails', 'Razor', 'Rat', 'Scar', 'Smoke', 'Snake', 'Spike', 'Tank', 'Tiny', 'Viper', 'Wolf', 'Zero'],
};

G.randomName = (rng, gender, street = false) => {
  const first = rng.pick(gender === 'female' ? G.NAMES.female : G.NAMES.male);
  const last = rng.pick(G.NAMES.last);
  if (street) return `${first} "${rng.pick(G.NAMES.street)}" ${last}`;
  return `${first} ${last}`;
};
