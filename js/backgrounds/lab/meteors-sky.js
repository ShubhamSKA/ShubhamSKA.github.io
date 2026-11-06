// The shooting stars background's sky, in development: constellations, bright
// stars and a dot font for names. Loaded before meteors.js, by the canvas lab
// only.

// The zodiac and some of the best-known constellations besides: each its
// stars, as [right ascension in hours, declination in degrees, magnitude],
// and the lines between them that draw its figure, in pairs of stars.
const SKY_CONSTELLATIONS = [
  {
    name: "ARIES",
    stars: [
      [2.833, 27.26, 3.6], // 41 Arietis
      [2.12, 23.46, 2.0], // Hamal
      [1.911, 20.81, 2.6], // Sheratan
      [1.892, 19.29, 3.9], // Mesarthim
    ],
    lines: [0, 1, 1, 2, 2, 3],
  },
  {
    name: "TAURUS",
    stars: [
      [4.599, 16.51, 0.85], // Aldebaran
      [5.438, 28.61, 1.65], // Elnath
      [5.627, 21.14, 3.0], // Zeta Tauri
      [4.478, 15.87, 3.4], // Theta Tauri
      [4.33, 15.63, 3.6], // Gamma Tauri
      [4.382, 17.54, 3.8], // Delta Tauri
      [4.477, 19.18, 3.5], // Epsilon Tauri
      [4.011, 12.49, 3.4], // Lambda Tauri
      [3.791, 24.11, 2.9], // Alcyone, and the rest of the Pleiades
      [3.747, 24.11, 3.7], // Electra
      [3.763, 24.37, 3.9], // Maia
      [3.772, 23.95, 4.1], // Merope
      [3.753, 24.47, 4.3], // Taygeta
      [3.819, 24.05, 3.6], // Atlas
    ],
    lines: [0, 3, 3, 4, 4, 5, 5, 6, 6, 1, 0, 2, 4, 7],
  },
  {
    name: "GEMINI",
    stars: [
      [7.577, 31.89, 1.6], // Castor
      [7.755, 28.03, 1.1], // Pollux
      [6.629, 16.4, 1.9], // Alhena
      [6.732, 25.13, 3.0], // Mebsuta
      [6.383, 22.51, 2.9], // Tejat
      [7.335, 21.98, 3.5], // Wasat
      [7.068, 20.57, 3.9], // Mekbuda
      [6.248, 22.51, 3.3], // Propus
      [7.74, 24.4, 3.6], // Kappa Geminorum
      [6.755, 12.9, 3.4], // Alzirr
    ],
    lines: [0, 3, 3, 4, 4, 7, 1, 8, 1, 5, 5, 6, 6, 2, 0, 1, 6, 9],
  },
  {
    name: "CANCER",
    stars: [
      [8.275, 9.19, 3.5], // Tarf
      [8.745, 18.15, 3.9], // Asellus Australis
      [8.721, 21.47, 4.7], // Asellus Borealis
      [8.975, 11.86, 4.3], // Acubens
      [8.778, 28.76, 4.0], // Iota Cancri
    ],
    lines: [0, 1, 1, 3, 1, 2, 2, 4],
  },
  {
    name: "LEO",
    stars: [
      [10.139, 11.97, 1.35], // Regulus
      [11.818, 14.57, 2.1], // Denebola
      [10.333, 19.84, 2.1], // Algieba
      [11.235, 20.52, 2.6], // Zosma
      [11.237, 15.43, 3.3], // Chertan
      [10.122, 16.76, 3.5], // Eta Leonis
      [10.278, 23.42, 3.4], // Adhafera
      [9.879, 26.01, 3.9], // Rasalas
      [9.764, 23.77, 3.0], // Algenubi
    ],
    lines: [0, 5, 5, 2, 2, 6, 6, 7, 7, 8, 2, 3, 3, 1, 1, 4, 4, 0, 3, 4],
  },
  {
    name: "VIRGO",
    stars: [
      [13.42, -11.16, 0.97], // Spica
      [12.694, -1.45, 2.7], // Porrima
      [13.036, 10.96, 2.8], // Vindemiatrix
      [12.927, 3.4, 3.4], // Minelauva
      [11.845, 1.76, 3.6], // Zavijava
      [12.332, -0.67, 3.9], // Zaniah
      [13.578, -0.6, 3.4], // Heze
      [13.166, -5.54, 4.4], // Theta Virginis
      [14.267, -6.0, 4.1], // Syrma
      [14.718, -5.66, 3.9], // Rijl al Awwa
    ],
    lines: [4, 5, 5, 1, 1, 3, 3, 2, 1, 7, 7, 0, 3, 6, 6, 8, 8, 9],
  },
  {
    name: "LIBRA",
    stars: [
      [14.848, -16.04, 2.75], // Zubenelgenubi
      [15.283, -9.38, 2.6], // Zubeneschamali
      [15.068, -25.28, 3.3], // Brachium
      [15.592, -14.79, 3.9], // Zubenelhakrabi
      [15.617, -28.14, 3.6], // Upsilon Librae
    ],
    lines: [0, 1, 1, 3, 0, 2, 3, 4, 0, 3],
  },
  {
    name: "SCORPIUS",
    stars: [
      [16.49, -26.43, 1.1], // Antares
      [16.091, -19.81, 2.6], // Acrab
      [16.006, -22.62, 2.3], // Dschubba
      [15.981, -26.11, 2.9], // Fang
      [16.353, -25.59, 2.9], // Alniyat
      [16.598, -28.22, 2.8], // Paikauhale
      [16.836, -34.29, 2.3], // Larawag
      [16.865, -38.05, 3.0], // Xamidimura
      [16.91, -42.36, 3.6], // Zeta Scorpii
      [17.203, -43.24, 3.3], // Eta Scorpii
      [17.622, -43.0, 1.9], // Sargas
      [17.793, -40.13, 3.0], // Iota Scorpii
      [17.708, -39.03, 2.4], // Girtab
      [17.56, -37.1, 1.6], // Shaula
      [17.513, -37.3, 2.7], // Lesath
    ],
    lines: [1, 2, 2, 3, 2, 4, 4, 0, 0, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14],
  },
  {
    name: "SAGITTARIUS",
    stars: [
      [18.403, -34.38, 1.85], // Kaus Australis
      [18.921, -26.3, 2.05], // Nunki
      [19.044, -29.88, 2.6], // Ascella
      [18.35, -29.83, 2.7], // Kaus Media
      [18.466, -25.42, 2.8], // Kaus Borealis
      [18.097, -30.42, 3.0], // Alnasl
      [18.761, -26.99, 3.2], // Phi Sagittarii
      [19.116, -27.67, 3.3], // Tau Sagittarii
      [18.294, -36.76, 3.1], // Eta Sagittarii
    ],
    lines: [5, 3, 3, 0, 0, 5, 3, 4, 4, 6, 6, 3, 6, 1, 1, 7, 7, 2, 2, 6, 2, 0, 0, 8],
  },
  {
    name: "CAPRICORNUS",
    stars: [
      [20.3, -12.54, 3.6], // Algedi
      [20.35, -14.78, 3.1], // Dabih
      [20.768, -25.27, 4.1], // Psi Capricorni
      [20.864, -26.92, 4.1], // Omega Capricorni
      [21.099, -17.23, 4.1], // Theta Capricorni
      [21.444, -22.41, 3.7], // Zeta Capricorni
      [21.668, -16.66, 3.7], // Nashira
      [21.784, -16.13, 2.9], // Deneb Algedi
    ],
    lines: [0, 1, 1, 2, 2, 3, 3, 5, 5, 7, 7, 6, 6, 4, 4, 0],
  },
  {
    name: "AQUARIUS",
    stars: [
      [21.526, -5.57, 2.9], // Sadalsuud
      [22.096, -0.32, 3.0], // Sadalmelik
      [22.911, -15.82, 3.3], // Skat
      [22.361, -1.39, 3.8], // Sadachbia
      [22.481, -0.02, 3.6], // Zeta Aquarii
      [22.589, -0.12, 4.0], // Eta Aquarii
      [22.421, 1.38, 4.7], // Pi Aquarii
      [22.877, -7.58, 3.7], // Lambda Aquarii
      [22.28, -7.78, 4.2], // Theta Aquarii
      [20.794, -9.5, 3.8], // Albali
      [23.157, -21.17, 3.7], // 88 Aquarii
    ],
    lines: [9, 0, 0, 1, 1, 3, 3, 4, 4, 5, 4, 6, 1, 8, 8, 7, 7, 2, 2, 10],
  },
  {
    name: "PISCES",
    stars: [
      [2.034, 2.76, 3.8], // Alrescha
      [1.525, 15.35, 3.6], // Alpherg
      [1.757, 9.16, 4.3], // Torcular
      [1.049, 7.89, 4.3], // Epsilon Piscium
      [0.811, 7.59, 4.4], // Delta Piscium
      [23.988, 6.86, 4.0], // Omega Piscium
      [23.666, 5.63, 4.1], // Iota Piscium
      [23.466, 6.38, 4.3], // Theta Piscium
      [23.286, 3.28, 3.7], // Gamma Piscium
      [23.449, 1.26, 4.9], // Kappa Piscium
      [23.7, 1.78, 4.5], // Lambda Piscium
      [1.23, 24.58, 4.7], // Phi Piscium
      [1.325, 27.26, 4.8], // Upsilon Piscium
      [1.194, 30.09, 4.5], // Tau Piscium
    ],
    lines: [8, 7, 7, 6, 6, 10, 10, 9, 9, 8, 6, 5, 5, 4, 4, 3, 3, 0, 0, 2, 2, 1, 1, 11, 11, 12, 12, 13],
  },
  {
    name: "ORION",
    stars: [
      [5.919, 7.41, 0.5], // Betelgeuse
      [5.242, -8.2, 0.13], // Rigel
      [5.418, 6.35, 1.6], // Bellatrix
      [5.796, -9.67, 2.1], // Saiph
      [5.679, -1.94, 1.8], // Alnitak
      [5.604, -1.2, 1.7], // Alnilam
      [5.533, -0.3, 2.2], // Mintaka
      [5.586, 9.93, 3.4], // Meissa
      [4.83, 6.96, 3.2], // Tabit, at the shield
    ],
    lines: [7, 0, 7, 2, 0, 4, 2, 6, 6, 5, 5, 4, 4, 3, 6, 1, 2, 8],
  },
  {
    name: "URSA MAJOR",
    stars: [
      [11.062, 61.75, 1.8], // Dubhe
      [11.031, 56.38, 2.4], // Merak
      [11.897, 53.69, 2.4], // Phecda
      [12.257, 57.03, 3.3], // Megrez
      [12.9, 55.96, 1.8], // Alioth
      [13.399, 54.93, 2.2], // Mizar
      [13.792, 49.31, 1.9], // Alkaid
    ],
    lines: [0, 1, 1, 2, 2, 3, 3, 0, 3, 4, 4, 5, 5, 6],
  },
  {
    name: "URSA MINOR",
    stars: [
      [2.53, 89.26, 2.0], // Polaris
      [17.537, 86.59, 4.4], // Yildun
      [16.766, 82.04, 4.2], // Epsilon Ursae Minoris
      [15.734, 77.79, 4.3], // Zeta Ursae Minoris
      [14.845, 74.16, 2.1], // Kochab
      [15.345, 71.83, 3.0], // Pherkad
      [16.292, 75.76, 5.0], // Eta Ursae Minoris
    ],
    lines: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 3],
  },
  {
    name: "CASSIOPEIA",
    stars: [
      [0.153, 59.15, 2.3], // Caph
      [0.675, 56.54, 2.2], // Schedar
      [0.945, 60.72, 2.5], // Gamma Cassiopeiae
      [1.43, 60.24, 2.7], // Ruchbah
      [1.907, 63.67, 3.4], // Segin
    ],
    lines: [0, 1, 1, 2, 2, 3, 3, 4],
  },
  {
    name: "CYGNUS",
    stars: [
      [20.69, 45.28, 1.25], // Deneb
      [20.37, 40.26, 2.2], // Sadr
      [19.512, 27.96, 3.1], // Albireo
      [20.77, 33.97, 2.5], // Aljanah
      [19.75, 45.13, 2.9], // Fawaris
      [21.216, 30.23, 3.2], // Zeta Cygni
      [19.938, 35.08, 3.9], // Eta Cygni
    ],
    lines: [0, 1, 1, 6, 6, 2, 4, 1, 1, 3, 3, 5],
  },
  {
    name: "LYRA",
    stars: [
      [18.616, 38.78, 0.03], // Vega
      [18.739, 39.67, 4.7], // Epsilon Lyrae
      [18.746, 37.61, 4.3], // Zeta Lyrae
      [18.908, 36.9, 4.3], // Delta Lyrae
      [18.982, 32.69, 3.3], // Sulafat
      [18.835, 33.36, 3.5], // Sheliak
    ],
    lines: [0, 1, 0, 2, 2, 3, 3, 4, 4, 5, 5, 2],
  },
  {
    name: "AQUILA",
    stars: [
      [19.846, 8.87, 0.77], // Altair
      [19.771, 10.61, 2.7], // Tarazed
      [19.922, 6.41, 3.7], // Alshain
      [19.09, 13.86, 3.0], // Okab
      [19.425, 3.11, 3.4], // Delta Aquilae
      [20.188, -0.82, 3.2], // Theta Aquilae
      [19.104, -4.88, 3.4], // Lambda Aquilae
    ],
    lines: [3, 1, 1, 0, 0, 2, 0, 4, 4, 6, 4, 5],
  },
  {
    name: "CANIS MAJOR",
    stars: [
      [6.752, -16.72, -1.46], // Sirius
      [6.378, -17.96, 2.0], // Mirzam
      [6.977, -28.97, 1.5], // Adhara
      [7.14, -26.39, 1.8], // Wezen
      [7.402, -29.3, 2.4], // Aludra
      [7.063, -15.63, 4.1], // Muliphein
      [6.936, -17.05, 4.4], // Iota Canis Majoris
    ],
    lines: [1, 0, 0, 6, 6, 5, 0, 3, 3, 2, 3, 4],
  },
  {
    name: "PEGASUS",
    stars: [
      [23.079, 15.21, 2.5], // Markab
      [23.063, 28.08, 2.4], // Scheat
      [0.22, 15.18, 2.8], // Algenib
      [0.14, 29.09, 2.1], // Alpheratz, shared with Andromeda
      [21.736, 9.88, 2.4], // Enif
      [22.691, 10.83, 3.4], // Homam
      [22.717, 30.22, 2.9], // Matar
    ],
    lines: [0, 1, 1, 3, 3, 2, 2, 0, 0, 5, 5, 4, 1, 6],
  },
  {
    name: "ANDROMEDA",
    stars: [
      [0.14, 29.09, 2.1], // Alpheratz
      [1.162, 35.62, 2.1], // Mirach
      [2.065, 42.33, 2.1], // Almach
      [0.655, 30.86, 3.3], // Delta Andromedae
    ],
    lines: [0, 3, 3, 1, 1, 2],
  },
  {
    name: "PERSEUS",
    stars: [
      [3.405, 49.86, 1.8], // Mirfak
      [3.136, 40.96, 2.1], // Algol
      [3.08, 53.51, 2.9], // Gamma Persei
      [3.715, 47.79, 3.0], // Delta Persei
      [3.964, 40.01, 2.9], // Epsilon Persei
      [3.902, 31.88, 2.9], // Menkib
    ],
    lines: [2, 0, 0, 3, 3, 4, 4, 5, 0, 1],
  },
  {
    name: "CRUX",
    stars: [
      [12.443, -63.1, 0.8], // Acrux
      [12.795, -59.69, 1.25], // Mimosa
      [12.519, -57.11, 1.6], // Gacrux
      [12.252, -58.75, 2.8], // Imai
    ],
    lines: [0, 2, 1, 3],
  },
];

// Bright stars outside those figures, so the sky round them looks as it does.
const SKY_BRIGHT = [
  [5.278, 46.0, 0.08], // Capella
  [14.261, 19.18, -0.05], // Arcturus
  [7.655, 5.22, 0.34], // Procyon
  [6.399, -52.7, -0.74], // Canopus
  [1.629, -57.24, 0.46], // Achernar
  [14.66, -60.83, -0.27], // Alpha Centauri
  [14.064, -60.37, 0.61], // Hadar
  [22.961, -29.62, 1.16], // Fomalhaut
  [9.46, -8.66, 1.98], // Alphard
  [15.578, 26.71, 2.23], // Alphecca
  [17.582, 12.56, 2.08], // Rasalhague
  [17.943, 51.49, 2.24], // Eltanin
  [17.507, 52.3, 2.79], // Rastaban
  [14.073, 64.38, 3.65], // Thuban
  [21.31, 62.59, 2.45], // Alderamin
  [0.727, -17.99, 2.04], // Diphda
  [3.038, 4.09, 2.54], // Menkar
  [14.111, -36.37, 2.06], // Menkent
  [22.137, -46.96, 1.74], // Alnair
  [20.427, -56.74, 1.94], // Peacock
  [8.375, -59.51, 1.86], // Avior
  [9.22, -69.72, 1.67], // Miaplacidus
  [8.159, -47.34, 1.83], // Regor
  [16.811, -69.03, 1.91], // Atria
  [9.133, -43.43, 2.21], // Suhail
  [8.06, -40.0, 2.25], // Naos
  [5.992, 44.95, 1.9], // Menkalinan
  [14.75, 27.07, 2.35], // Izar
  [13.911, 18.4, 2.68], // Muphrid
  [12.263, -17.54, 2.58], // Gienah
  [12.573, -23.4, 2.65], // Kraz
  [12.498, -16.52, 2.94], // Algorab
  [16.504, 21.49, 2.77], // Kornephoros
  [17.173, -15.72, 2.43], // Sabik
  [16.619, -10.57, 2.54], // Zeta Ophiuchi
  [16.239, -3.69, 2.73], // Yed Prior
  [5.661, -34.07, 2.65], // Phact
  [5.546, -17.82, 2.58], // Arneb
  [7.286, -37.1, 2.7], // Pi Puppis
];

// Capital letters, five dots wide and seven high, a row to a number, its
// leftmost dot the highest bit; for the constellations' names.
const SKY_LETTERS = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
};
