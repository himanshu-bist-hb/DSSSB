import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import sql from "mssql";

// A long-distance connection to Azure SQL combined with the seed script's
// one-row-at-a-time upserts can run for several minutes; the driver's
// default request/pool timeouts (15s / 30s) are too short for that, so a
// plain sql.config is built here (instead of a connection string) so those
// timeouts can be widened.
function parseDatabaseUrl(url: string): sql.config {
  const withoutProtocol = url.replace(/^sqlserver:\/\//, "");
  const [hostPart, ...paramParts] = withoutProtocol.split(";");
  const [server, portStr] = hostPart.split(":");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    params[part.slice(0, idx).trim()] = part.slice(idx + 1);
  }
  return {
    server,
    port: portStr ? parseInt(portStr, 10) : undefined,
    database: params.database,
    user: params.user,
    password: params.password,
    options: {
      encrypt: params.encrypt?.toLowerCase() !== "false",
      trustServerCertificate: params.trustServerCertificate?.toLowerCase() === "true",
    },
    requestTimeout: 120_000,
    connectionTimeout: 30_000,
    pool: { max: 5, idleTimeoutMillis: 120_000, acquireTimeoutMillis: 60_000 },
  };
}

const adapter = new PrismaMssql(parseDatabaseUrl(process.env.DATABASE_URL!));
const prisma = new PrismaClient({ adapter });

// SQL Server has no native enum type, so Difficulty is a plain string column.
const Difficulty = { EASY: "EASY", MEDIUM: "MEDIUM", HARD: "HARD" } as const;
type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

type SeedQuestion = {
  text: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explanation: string;
  difficulty: Difficulty;
  isPYQ?: boolean;
  pyqYear?: number;
};

const OPT_IDS = ["a", "b", "c", "d"] as const;

function q(input: SeedQuestion) {
  return {
    text: input.text,
    // SQL Server has no native Json column type, so options are stored as a JSON string.
    options: JSON.stringify(OPT_IDS.map((id, i) => ({ id, text: input.options[i] }))),
    correctOption: OPT_IDS[input.correct],
    explanation: input.explanation,
    difficulty: input.difficulty,
    isPYQ: input.isPYQ ?? false,
    pyqYear: input.pyqYear,
  };
}

type SeedTopic = {
  slug: string;
  name: string;
  questions: ReturnType<typeof q>[];
};

type SeedSubject = {
  slug: string;
  name: string;
  topics: SeedTopic[];
};

const SUBJECTS: SeedSubject[] = [
  {
    slug: "geography",
    name: "Geography",
    topics: [
      {
        slug: "earth-in-the-solar-system",
        name: "The Earth in the Solar System",
        questions: [
          q({
            text: "Which of the following is classified as a Jovian (gas giant) planet in our solar system?",
            options: ["Saturn", "Mercury", "Mars", "Venus"],
            correct: 0,
            explanation: "Saturn, along with Jupiter, Uranus and Neptune, is a Jovian or gas giant planet, characterised by a large size, low density and gaseous composition, unlike the smaller rocky terrestrial planets.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "What is the fundamental difference between a star and a planet?",
            options: [
              "Stars are smaller than planets",
              "Stars have their own heat and light; planets shine by reflecting light from a star",
              "Planets are hotter than stars",
              "Stars revolve around planets",
            ],
            correct: 1,
            explanation:
              "Stars (like the Sun) are huge, hot bodies made of gases that emit their own heat and light. Planets do not have their own light; they are visible because they reflect the light of a star (the Sun, in our solar system).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which celestial body is correctly described as the 'Head' of the solar family?",
            options: ["Earth", "Moon", "Sun", "Jupiter"],
            correct: 2,
            explanation:
              "The Sun lies at the centre of the solar system and provides the gravitational pull that binds all planets, satellites, asteroids and meteoroids together, making it the head of the 'solar family'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Arrange the following planets in the correct order of increasing distance from the Sun: Mars, Mercury, Earth, Venus.",
            options: [
              "Mercury, Venus, Earth, Mars",
              "Mercury, Earth, Venus, Mars",
              "Venus, Mercury, Earth, Mars",
              "Mercury, Venus, Mars, Earth",
            ],
            correct: 0,
            explanation:
              "The order of planets by distance from the Sun is Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune — commonly memorised as 'My Very Efficient Mother Just Served Us Nuts'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Venus is often called the 'Earth's Twin'. What is the reason for this name?",
            options: [
              "It has the same number of moons as Earth",
              "It is the same distance from the Sun as Earth",
              "Its size and shape are very similar to those of the Earth",
              "It supports life like the Earth",
            ],
            correct: 2,
            explanation:
              "Venus is called the Earth's twin because its size and shape closely resemble those of the Earth, even though its atmosphere and surface conditions are completely different and hostile to life.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Why is the Earth's shape described as a 'Geoid' rather than a perfect sphere?",
            options: [
              "It is bulged at the poles and flattened at the equator",
              "It is flattened at the poles and slightly bulged at the equator (middle)",
              "It is a perfect cube",
              "It has no definite shape",
            ],
            correct: 1,
            explanation:
              "The Earth is slightly flattened at the North and South Poles and bulges a little at the equator (middle). This unique, earth-like shape is called a Geoid ('geo' = earth-like).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 2006, the International Astronomical Union reclassified Pluto as a:",
            options: ["Star", "Asteroid", "Dwarf planet", "Satellite"],
            correct: 2,
            explanation:
              "In August 2006, the IAU decided that Pluto, along with objects like Ceres and 2003 UB313, should be classified as 'dwarf planets' rather than full planets, reducing the count of major planets to eight.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Why is the Earth called the 'Blue Planet'?",
            options: [
              "Because its atmosphere is blue in colour",
              "Because about two-thirds of its surface is covered by water, giving it a blue appearance from space",
              "Because it is the coldest planet",
              "Because it has blue-coloured soil",
            ],
            correct: 1,
            explanation:
              "Seen from outer space, the Earth appears blue because nearly two-thirds of its surface is covered with water. This is why it is popularly called the 'Blue Planet'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Asteroids, the numerous tiny bodies that revolve around the Sun, are mainly found between the orbits of:",
            options: ["Earth and Mars", "Mars and Jupiter", "Jupiter and Saturn", "Saturn and Uranus"],
            correct: 1,
            explanation:
              "Asteroids are small rocky bodies found orbiting the Sun mainly in the belt between the orbits of Mars and Jupiter. Scientists believe they may be remnants of a planet that broke apart.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "A meteoroid that enters the Earth's atmosphere and burns up due to friction with air, producing a flash of light, is popularly known as a:",
            options: ["Comet", "Shooting star", "Satellite", "Nebula"],
            correct: 1,
            explanation:
              "When a meteoroid comes close to the Earth and burns up due to friction with the atmosphere, it produces a streak of light popularly (though loosely) called a 'shooting star'; if it survives and hits the ground, it is called a meteorite.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Our solar system is a part of which galaxy, called 'Akash Ganga' in ancient India?",
            options: ["Andromeda Galaxy", "Milky Way Galaxy", "Whirlpool Galaxy", "Sombrero Galaxy"],
            correct: 1,
            explanation:
              "The Milky Way is a huge system of billions of stars, dust and gases that appears as a whitish band across the night sky. Our solar system is part of this galaxy, which ancient Indians pictured as a river of light and named 'Akash Ganga'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Why do we always see only one side of the Moon from the Earth?",
            options: [
              "Because the Moon does not rotate on its axis at all",
              "Because the Moon takes the same time to complete one rotation as it takes to complete one revolution around the Earth",
              "Because the Earth blocks our view of the other side permanently",
              "Because the Moon is tidally repelled by the Earth",
            ],
            correct: 1,
            explanation:
              "The Moon takes about 27 days to revolve around the Earth and exactly the same time to complete one rotation on its axis. Because its rotation and revolution periods match (synchronous/tidal locking), only one side of the Moon ever faces the Earth.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which ancient Indian astronomer stated that the Moon and planets shine due to reflected sunlight?",
            options: ["Varahamihira", "Aryabhata", "Brahmagupta", "Bhaskaracharya"],
            correct: 1,
            explanation:
              "Aryabhata, the celebrated ancient Indian astronomer, explained that the Moon and the planets shine because they reflect sunlight, and also stated that the Earth is round and rotates on its own axis.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "globe-latitudes-and-longitudes",
        name: "Globe: Latitudes and Longitudes",
        questions: [
          q({
            text: "A globe is best described as:",
            options: [
              "A flat drawing of the Earth's surface",
              "A true, miniature (scaled-down) model of the Earth",
              "A map showing only political boundaries",
              "An instrument used to measure temperature",
            ],
            correct: 1,
            explanation:
              "A globe is a true model of the Earth in miniature form. Unlike a flat map, it represents the correct shape, size and relative position of countries, continents and oceans because it shares the Earth's spherical (geoid) shape.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The imaginary line that divides the globe into the Northern and Southern Hemispheres is the:",
            options: ["Prime Meridian", "Tropic of Cancer", "Equator", "International Date Line"],
            correct: 2,
            explanation:
              "The Equator is an imaginary circular line at 0° latitude that divides the Earth into two equal halves — the Northern Hemisphere and the Southern Hemisphere.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "What is the latitudinal value of the North Pole and South Pole respectively?",
            options: ["0° N and 0° S", "23½° N and 23½° S", "90° N and 90° S", "66½° N and 66½° S"],
            correct: 2,
            explanation:
              "Since the distance from the equator to a pole is one-fourth of a full circle (¼ of 360°), it equals 90°. Hence the North Pole is at 90° N latitude and the South Pole is at 90° S latitude.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT one of the four important parallels of latitude (besides the equator and the poles)?",
            options: ["Tropic of Cancer", "Tropic of Capricorn", "Arctic Circle", "International Date Line"],
            correct: 3,
            explanation:
              "The four important parallels of latitude are the Tropic of Cancer (23½° N), Tropic of Capricorn (23½° S), Arctic Circle (66½° N) and Antarctic Circle (66½° S). The International Date Line is not a parallel of latitude — it broadly follows the 180° meridian of longitude.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The area between the Tropic of Cancer and the Tropic of Capricorn, which receives the maximum amount of heat, is called the:",
            options: ["Frigid Zone", "Temperate Zone", "Torrid Zone", "Polar Zone"],
            correct: 2,
            explanation:
              "The mid-day Sun is exactly overhead at least once a year on every latitude between the Tropic of Cancer and the Tropic of Capricorn, so this belt receives maximum heat and is called the Torrid Zone.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The region lying between the Arctic Circle and the North Pole (and similarly between the Antarctic Circle and the South Pole) is called the:",
            options: ["Torrid Zone", "Temperate Zone", "Frigid Zone", "Equatorial Zone"],
            correct: 2,
            explanation:
              "In these polar regions, the Sun's rays are always slanting and never rise much above the horizon, so very little heat is received. These very cold areas are called the Frigid Zones.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Meridians of longitude differ from parallels of latitude in that:",
            options: [
              "Longitudes are of unequal length while latitudes are all equal",
              "All meridians of longitude are semi-circles of equal length, while parallels of latitude are complete circles that decrease in size towards the poles",
              "There are 90 meridians and 360 parallels",
              "Longitudes are measured in kilometres, latitudes in degrees",
            ],
            correct: 1,
            explanation:
              "Meridians of longitude are semi-circles running from the North Pole to the South Pole and are all equal in length. Parallels of latitude, on the other hand, are full circles parallel to the equator whose size steadily decreases from the equator towards the poles.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Prime Meridian (0° longitude) passes through which city, home to the British Royal Observatory?",
            options: ["Paris", "New York", "Greenwich", "Moscow"],
            correct: 2,
            explanation:
              "By international agreement, the meridian passing through Greenwich (where the British Royal Observatory is located) was fixed as the Prime Meridian, with a value of 0° longitude, from which 180° is counted both eastward and westward.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Earth rotates 360° in about 24 hours. What is the corresponding time difference for every 1° of longitude?",
            options: ["1 minute", "2 minutes", "4 minutes", "15 minutes"],
            correct: 2,
            explanation:
              "Since the Earth completes 360° of rotation in 24 hours, it covers 15° every hour (360/24), which works out to 1° in 4 minutes (60/15). This is the basis for calculating local time differences between places.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Indian Standard Time (IST) is based on the local time of which standard meridian?",
            options: ["0° (Greenwich)", "90° E", "82½° E", "68½° E"],
            correct: 2,
            explanation:
              "India adopted 82½° E (82°30' E), passing near Mirzapur (Uttar Pradesh), as its Standard Meridian. The local time at this meridian is taken as the Indian Standard Time for the whole country, which is 5 hours 30 minutes ahead of GMT.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Earth has been divided into how many time zones for the purpose of standard time, and how many degrees of longitude does each zone typically cover?",
            options: ["12 zones of 30° each", "24 zones of 15° each", "36 zones of 10° each", "48 zones of 7.5° each"],
            correct: 1,
            explanation:
              "Since the Earth rotates 360° in 24 hours (15° per hour), it has been divided into 24 time zones, each covering 15° of longitude, to standardise time-keeping across the world.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Why does a large country like Russia use multiple standard times instead of just one?",
            options: [
              "Because it lies entirely within the Torrid Zone",
              "Because of its very great east-west (longitudinal) extent",
              "Because it has no Prime Meridian passing through it",
              "Because it lies on the equator",
            ],
            correct: 1,
            explanation:
              "Countries with a very large longitudinal (east-west) extent, such as Russia (about 11 standard times), the USA (seven time zones) and Canada (six time zones), adopt multiple standard times because a single time would be highly inconvenient across such a vast east-west spread.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "motions-of-the-earth",
        name: "Motions of the Earth",
        questions: [
          q({
            text: "The Sun's rays fall vertically overhead on the Tropic of Cancer on which date, marking the summer solstice in the Northern Hemisphere?",
            options: ["21 June", "22 December", "21 March", "23 September"],
            correct: 0,
            explanation: "On 21 June, the Sun's vertical rays fall directly on the Tropic of Cancer (23.5°N), marking the summer solstice in the Northern Hemisphere, with the longest day there.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Earth's rotation on its axis is directly responsible for which of the following phenomena?",
            options: ["The alternation of day and night", "The occurrence of seasons", "The length of a year", "The tilt of the axis itself"],
            correct: 0,
            explanation: "Rotation — the Earth spinning on its own axis once every 24 hours — causes the alternation of day and night; seasons and the length of the year result from the Earth's revolution around the Sun, not its rotation.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Earth takes approximately how long to complete one full rotation on its axis relative to the stars (a sidereal day)?",
            options: ["23 hours 56 minutes", "24 hours exactly", "23 hours 30 minutes", "24 hours 30 minutes"],
            correct: 0,
            explanation: "A sidereal day, the time for one complete rotation of the Earth relative to distant stars, is about 23 hours 56 minutes — slightly shorter than the 24-hour solar day used in everyday timekeeping.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The movement of the Earth on its own axis is called:",
            options: ["Revolution", "Rotation", "Inclination", "Precession"],
            correct: 1,
            explanation:
              "Rotation is the spinning movement of the Earth on its own imaginary axis, completed in about 24 hours, and is responsible for day and night.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Earth's axis makes an angle of approximately how much with its orbital plane?",
            options: ["23½°", "45°", "66½°", "90°"],
            correct: 2,
            explanation:
              "The Earth's axis is inclined at an angle of about 66½° to the plane of its orbit (the orbital plane) — equivalently, it is tilted 23½° from the perpendicular to the orbital plane.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The imaginary circle on the globe that separates the illuminated (day) half of the Earth from the dark (night) half is called the:",
            options: ["Equator", "Circle of Illumination", "Tropic Circle", "Meridian Circle"],
            correct: 1,
            explanation:
              "Because the Earth is spherical, only half of it receives sunlight at any given time. The circle dividing the illuminated half from the dark half is called the Circle of Illumination.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Approximately how long does the Earth take to complete one revolution around the Sun?",
            options: ["24 hours", "27 days", "365¼ days", "29½ days"],
            correct: 2,
            explanation:
              "The Earth takes about 365¼ days (one year) to complete one revolution around the Sun in its elliptical orbit. The extra quarter-day each year is accumulated and added as one day (29 February) every fourth year, called a leap year.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "A 'leap year' contains how many days, and why?",
            options: [
              "365 days, because it is an ordinary year",
              "366 days, because the extra six hours accumulated over four years are added as one day to February",
              "367 days, to adjust for the Moon's revolution",
              "364 days, to adjust for rotation errors",
            ],
            correct: 1,
            explanation:
              "Since the Earth actually takes 365 days and about 6 hours to revolve around the Sun, the extra 6 hours per year accumulate to make one full day (24 hours) every four years. This extra day is added to February, making it 29 days instead of 28, and that year is called a leap year with 366 days.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "On 21st June, which position of the Earth causes the Northern Hemisphere to experience its longest day and shortest night?",
            options: ["Winter Solstice", "Summer Solstice", "Autumnal Equinox", "Vernal Equinox"],
            correct: 1,
            explanation:
              "On 21st June, the Northern Hemisphere is tilted towards the Sun and the Sun's rays fall directly (vertically) on the Tropic of Cancer. This position, called the Summer Solstice, gives the Northern Hemisphere its longest day and shortest night, while the Southern Hemisphere experiences winter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On 22nd December, the Sun's vertical rays fall directly on the Tropic of Capricorn. This position of the Earth is known as the:",
            options: ["Summer Solstice", "Winter Solstice", "Spring Equinox", "Autumn Equinox"],
            correct: 1,
            explanation:
              "On 22nd December, the South Pole is tilted towards the Sun and the Sun's vertical rays fall on the Tropic of Capricorn (23½° S). This is called the Winter Solstice (with reference to the Northern Hemisphere), while it is summer with longer days in the Southern Hemisphere — which is why Australia celebrates Christmas in summer.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On 21st March and 23rd September, direct/vertical rays of the Sun fall on the equator and the whole Earth experiences equal days and equal nights. This is called:",
            options: ["Solstice", "Equinox", "Perihelion", "Aphelion"],
            correct: 1,
            explanation:
              "On these two dates, neither pole is tilted towards the Sun, so the vertical rays fall on the equator and every part of the Earth has equal day and equal night. This condition is called an equinox (from Latin, meaning 'equal night').",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The changing seasons on Earth (summer, winter, spring, autumn) occur mainly because of:",
            options: [
              "Rotation of the Earth alone",
              "The Earth's revolution around the Sun combined with the fixed inclination of its axis",
              "Changes in the Earth's distance from the Moon",
              "Variation in the speed of the Earth's rotation",
            ],
            correct: 1,
            explanation:
              "As the Earth revolves around the Sun in its elliptical orbit while its axis remains inclined in a fixed direction, different parts of the Earth receive the Sun's direct rays at different times of the year, causing the cycle of seasons.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Places beyond the Arctic Circle experience continuous daylight for about six months. This happens because:",
            options: [
              "The Earth stops rotating there",
              "The North Pole area remains inclined towards the Sun for that period during the Earth's revolution",
              "There is no atmosphere at the poles",
              "The Moon blocks sunlight for the rest of the year",
            ],
            correct: 1,
            explanation:
              "As the Earth revolves with its axis tilted in a fixed direction, the North Pole is inclined towards the Sun for roughly half the year, giving areas beyond the Arctic Circle continuous daylight during that period, and continuous darkness during the other half.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "maps",
        name: "Maps",
        questions: [
          q({
            text: "What is a map, as distinguished from a globe?",
            options: [
              "A three-dimensional model of the Earth",
              "A drawing of the whole or a part of the Earth's surface, reduced to scale, on a flat surface",
              "Only a picture of a country's flag and boundary",
              "An instrument to measure altitude",
            ],
            correct: 1,
            explanation:
              "A map is a representation or drawing of the Earth's surface, or a part of it, drawn on a flat surface according to a scale. Unlike a globe, it can show a specific region (country, state, district, village) in greater detail.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "A collection of maps bound together is called a/an:",
            options: ["Chart", "Atlas", "Sketch", "Legend"],
            correct: 1,
            explanation:
              "When many maps of varying scale and content are put together in a bound volume, the collection is called an Atlas.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Maps showing natural features such as mountains, plateaus, plains and rivers are called:",
            options: ["Political maps", "Thematic maps", "Physical (relief) maps", "Cadastral maps"],
            correct: 2,
            explanation:
              "Maps that depict the natural (relief) features of the Earth's surface — mountains, plateaus, plains, oceans, rivers, etc. — are called physical or relief maps.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "A map that focuses on specific information, such as road networks or rainfall distribution, is known as a:",
            options: ["Political map", "Physical map", "Thematic map", "Plan"],
            correct: 2,
            explanation:
              "Thematic maps focus on particular themes or specific information — such as roads, rainfall, or the distribution of forests and industries — and are given a suitable title based on that theme.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is NOT one of the three main components of a map?",
            options: ["Distance (Scale)", "Direction", "Symbol", "Population"],
            correct: 3,
            explanation:
              "The three essential components of any map are distance (represented through a scale), direction, and symbols. Population is data that may be shown using symbols on a thematic map, but it is not itself a basic 'component' of maps.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "If 1 cm on a map represents 5 km on the ground, and another map shows 5 cm representing 500 km, which map is the 'large scale' map and which is 'small scale'?",
            options: [
              "1 cm = 5 km is large scale; 5 cm = 500 km is small scale",
              "1 cm = 5 km is small scale; 5 cm = 500 km is large scale",
              "Both are large scale",
              "Both are small scale",
            ],
            correct: 0,
            explanation:
              "A large-scale map shows a small area in greater detail (1 cm representing a small ground distance, e.g., 1 cm = 5 km), while a small-scale map shows a large area with less detail (a small map distance representing a large ground distance, e.g., 5 cm = 500 km). Large-scale maps give more information than small-scale maps.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Besides the four cardinal directions (North, South, East, West), the four intermediate directions are:",
            options: [
              "Up, Down, Left, Right",
              "North-East, South-East, South-West, North-West",
              "Upper-North, Lower-South, Mid-East, Mid-West",
              "True North, Magnetic North, Grid North, Map North",
            ],
            correct: 1,
            explanation:
              "The four cardinal points are North, South, East and West. The four intermediate directions, which help locate places more precisely, are North-East (NE), South-East (SE), South-West (SW) and North-West (NW).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which instrument is used to find the main directions, its magnetic needle always pointing north-south?",
            options: ["Barometer", "Compass", "Altimeter", "Thermometer"],
            correct: 1,
            explanation:
              "A compass is an instrument with a magnetic needle that always aligns in the north-south direction, allowing us to determine directions accurately in the field.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Why are conventional symbols important in map-making?",
            options: [
              "They make maps colourful only for decoration",
              "They allow a lot of information to be shown in a limited space in a universal language understood internationally",
              "They are compulsory only for political maps",
              "They replace the need for a scale",
            ],
            correct: 1,
            explanation:
              "It is impossible to draw the actual shape and size of features like buildings, roads, bridges or wells on a map. Conventional symbols, agreed upon internationally, represent such features compactly, allowing maps to be read as a universal language regardless of the local language of an area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A rough, not-to-scale drawing made mainly from memory and spot observation to show the way to a place is called a:",
            options: ["Plan", "Sketch (sketch map)", "Political map", "Physical map"],
            correct: 1,
            explanation:
              "A sketch (or sketch map) is a rough drawing based on memory and observation, made without following a scale, typically used to quickly show the general layout of an area or route.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A drawing of a small area, such as a room or a classroom, made accurately to a large scale, is called a:",
            options: ["Plan", "Atlas", "Sketch", "Thematic map"],
            correct: 0,
            explanation:
              "A plan is a scaled drawing of a small area (like a room, house or classroom) that shows precise details such as length and breadth, which a general large-scale map may not capture.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which colour is conventionally used on physical maps to represent water bodies?",
            options: ["Green", "Yellow", "Blue", "Brown"],
            correct: 2,
            explanation:
              "By convention, blue is used for water bodies, brown for mountains, yellow for plateaus and green for plains on physical/relief maps.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "major-domains-of-the-earth",
        name: "Major Domains of the Earth",
        questions: [
          q({
            text: "The four major domains (spheres) of the Earth's environment are:",
            options: [
              "Lithosphere, Hydrosphere, Atmosphere, Biosphere",
              "Troposphere, Stratosphere, Mesosphere, Thermosphere",
              "Continents, Oceans, Islands, Peninsulas",
              "Mountains, Plateaus, Plains, Deserts",
            ],
            correct: 0,
            explanation:
              "The Earth's surface is a complex zone where four domains meet and interact: the Lithosphere (solid land), the Hydrosphere (water bodies), the Atmosphere (gaseous envelope) and the Biosphere (the narrow zone supporting life).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In Greek, 'Lithos' means stone, 'Hudor' means water, 'Bios' means life. What does 'Atmos' mean, giving us the term Atmosphere?",
            options: ["Air", "Vapour", "Fire", "Cloud"],
            correct: 1,
            explanation:
              "In Greek, 'Atmos' means vapour, and 'sphaira' means globe/sphere — together giving 'Atmosphere', the gaseous envelope of vapour and gases surrounding the Earth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which is the largest continent, covering about one-third of the Earth's total land area?",
            options: ["Africa", "Asia", "North America", "Europe"],
            correct: 1,
            explanation:
              "Asia is the largest continent, covering roughly one-third of the world's total land area. It lies mainly in the Eastern Hemisphere, and the Tropic of Cancer passes through it.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which continent is the only one through which the Tropic of Cancer, the Equator, AND the Tropic of Capricorn all pass?",
            options: ["Asia", "South America", "Africa", "Australia"],
            correct: 2,
            explanation:
              "Africa is unique in that all three major latitudes — the Tropic of Cancer, the Equator, and the Tropic of Capricorn — pass through it. It is also home to the Sahara, the world's largest hot desert, and the Nile, the world's longest river.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "North America is connected to South America by a narrow strip of land called the:",
            options: ["Isthmus of Suez", "Isthmus of Panama", "Strait of Gibraltar", "Palk Strait"],
            correct: 1,
            explanation:
              "The Isthmus of Panama is the narrow strip of land that links North America and South America. An isthmus is a narrow strip of land connecting two larger land masses.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which continent lies entirely in the Southern Hemisphere, is surrounded by oceans on all sides, and is called an 'island continent'?",
            options: ["Africa", "Antarctica", "Australia", "South America"],
            correct: 2,
            explanation:
              "Australia is the smallest continent, lying entirely in the Southern Hemisphere and surrounded on all sides by oceans and seas, earning it the nickname 'island continent'. (Antarctica is also entirely in the Southern Hemisphere but is not called an island continent in the NCERT text.)",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's research stations in Antarctica are named:",
            options: ["Amundsen and Scott", "Maitri and Dakshin Gangotri", "Vostok and Mirny", "McMurdo and Halley"],
            correct: 1,
            explanation:
              "India maintains research stations in Antarctica named Maitri and Dakshin Gangotri, contributing to international scientific research in the polar continent, which has no permanent human settlements.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Arrange the five oceans in decreasing order of size, starting with the largest.",
            options: [
              "Atlantic, Pacific, Indian, Arctic, Southern",
              "Pacific, Atlantic, Indian, Southern, Arctic",
              "Indian, Pacific, Atlantic, Southern, Arctic",
              "Pacific, Indian, Atlantic, Arctic, Southern",
            ],
            correct: 1,
            explanation:
              "In order of decreasing size, the five oceans are: the Pacific Ocean (largest), the Atlantic Ocean, the Indian Ocean, the Southern Ocean, and the Arctic Ocean (smallest).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which is the only ocean in the world named after a country?",
            options: ["Atlantic Ocean", "Pacific Ocean", "Indian Ocean", "Arctic Ocean"],
            correct: 2,
            explanation:
              "The Indian Ocean is the only ocean named after a country — India. It is roughly triangular in shape, bound by Asia in the north, Africa in the west, and Australia in the east.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which two gases together make up about 99 per cent of the Earth's clean, dry atmosphere?",
            options: ["Oxygen and Carbon dioxide", "Nitrogen and Oxygen", "Nitrogen and Carbon dioxide", "Oxygen and Argon"],
            correct: 1,
            explanation:
              "The atmosphere is composed mainly of Nitrogen (about 78%) and Oxygen (about 21%), which together account for about 99% of clean, dry air; the remaining 1% includes carbon dioxide, argon and other gases.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Starting from the Earth's surface, what is the correct order of the layers of the atmosphere?",
            options: [
              "Stratosphere, Troposphere, Mesosphere, Thermosphere, Exosphere",
              "Troposphere, Stratosphere, Mesosphere, Thermosphere, Exosphere",
              "Troposphere, Mesosphere, Stratosphere, Exosphere, Thermosphere",
              "Exosphere, Thermosphere, Mesosphere, Stratosphere, Troposphere",
            ],
            correct: 1,
            explanation:
              "From the Earth's surface upward, the five layers of the atmosphere are: Troposphere, Stratosphere, Mesosphere, Thermosphere and Exosphere (the outermost layer).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The deepest point on Earth, the Mariana Trench (about 11,022 metres deep), is located in which ocean?",
            options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"],
            correct: 2,
            explanation:
              "The Mariana Trench, the greatest known depth on Earth at about 11,022 metres, lies in the Pacific Ocean — deeper than Mount Everest (8,848 m) is tall.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "major-landforms-of-the-earth",
        name: "Major Landforms of the Earth",
        questions: [
          q({
            text: "Landforms of the Earth result from two broad processes. What are they called?",
            options: [
              "Weathering and transportation",
              "Internal process (uplift/sinking) and external process (erosion and deposition)",
              "Rotation and revolution",
              "Convection and conduction",
            ],
            correct: 1,
            explanation:
              "Landforms are shaped by internal processes (movement within the Earth causing upliftment and sinking of the surface) and external processes (continuous wearing down by erosion and rebuilding by deposition, carried out by running water, ice and wind).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Broadly, landforms are grouped by elevation and slope into three main types. These are:",
            options: [
              "Mountains, Plateaus, Plains",
              "Hills, Valleys, Deserts",
              "Glaciers, Rivers, Deltas",
              "Continents, Islands, Peninsulas",
            ],
            correct: 0,
            explanation:
              "Landforms are broadly classified, based on elevation and slope, into three types: mountains (highest elevation), plateaus (flat-topped elevated land), and plains (large stretches of flat, low-lying land).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is an example of OLD fold mountains, considerably worn down by erosion, unlike the young and rugged Himalayas?",
            options: ["The Andes", "The Alps", "The Aravali Range", "The Rockies"],
            correct: 2,
            explanation:
              "The Aravali Range in India is one of the oldest fold mountain systems in the world and has been considerably worn down by erosion, unlike young fold mountains like the Himalayas and the Alps, which have rugged relief and high conical peaks.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Block mountains are formed when large areas of land are broken and displaced vertically. The uplifted blocks are called 'horsts', and the lowered/sunken blocks are called:",
            options: ["Graben", "Plateau", "Delta", "Trench"],
            correct: 0,
            explanation:
              "In block mountain formation, large areas break and shift vertically along faults. The uplifted blocks are called horsts, while the relatively lowered blocks are called graben. The Rhine Valley and Vosges Mountains in Europe are classic examples.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Mt. Kilimanjaro (Africa) and Mt. Fujiyama (Japan) are famous examples of which type of mountain?",
            options: ["Fold mountains", "Block mountains", "Volcanic mountains", "Residual mountains"],
            correct: 2,
            explanation:
              "Mt. Kilimanjaro in Africa and Mt. Fujiyama in Japan are volcanic mountains, formed due to volcanic activity where molten material erupts and accumulates to build up a cone-shaped peak.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is described in the NCERT textbook as one of the oldest plateaus, located in India?",
            options: ["Tibet Plateau", "Deccan Plateau", "East African Plateau", "Western Plateau of Australia"],
            correct: 1,
            explanation:
              "The Deccan Plateau in India is cited as one of the oldest plateaus in the world. In contrast, the Tibet Plateau is noted as the highest plateau in the world, at 4,000–6,000 metres above mean sea level.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Why are plateau regions economically significant in terms of mineral resources?",
            options: [
              "They are usually covered with thick forests only",
              "They are rich in mineral deposits, so many mining areas of the world are located on plateaus",
              "They have the highest agricultural productivity",
              "They contain the world's largest deserts",
            ],
            correct: 1,
            explanation:
              "Plateaus are rich in mineral deposits — for example, the African Plateau is famous for gold and diamond mining, while India's Chhotanagpur Plateau has huge reserves of iron, coal and manganese, making plateaus important mining regions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of these waterfalls, formed as a river falls from a great height over a plateau, is located in India?",
            options: ["Niagara Falls", "Victoria Falls", "Jog Falls", "Angel Falls"],
            correct: 2,
            explanation:
              "Jog Falls in Karnataka and Hundru Falls (on the river Subarnarekha) in the Chhotanagpur Plateau are Indian examples of waterfalls formed where rivers fall from a great height across plateau terrain.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Most of the world's large plains, such as those formed by the Ganga-Brahmaputra and the Yangtze, are formed through the process of:",
            options: [
              "Volcanic eruption",
              "Deposition of alluvial material (stones, sand and silt) carried by rivers",
              "Wind erosion of deserts",
              "Glacial carving of rock",
            ],
            correct: 1,
            explanation:
              "Plains are largely formed when rivers erode material from mountain slopes, carry it downstream, and deposit stones, sand and silt along their courses and valleys — this alluvial deposition builds up fertile plains.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Why are river plains among the most densely populated regions of the world?",
            options: [
              "They have the coldest climate, suitable for large populations",
              "They offer fertile soil for cultivation, flat land for construction, and ease of building transport networks",
              "They are located far from any water source",
              "They have the highest mineral wealth in the world",
            ],
            correct: 1,
            explanation:
              "Plains are generally very fertile due to alluvial deposits, make construction of houses, roads and railways easy, and support high agricultural productivity — all of which make them the most densely populated regions, such as the Indo-Gangetic Plains in India.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "our-country-india",
        name: "Our Country – India",
        questions: [
          q({
            text: "What is the approximate north-south extent of India from Kashmir to Kanyakumari?",
            options: ["2,900 km", "3,200 km", "3,500 km", "2,500 km"],
            correct: 1,
            explanation:
              "India's north-south extent, from Kashmir to Kanyakumari, is about 3,200 km, while its east-west extent, from Arunachal Pradesh to Kuchchh (Gujarat), is about 2,900 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Tropic of Cancer (23°30' N) passes through India in a manner best described as:",
            options: [
              "It passes through the extreme south of India only",
              "It passes almost halfway through the country",
              "It does not pass through India at all",
              "It passes only through coastal states",
            ],
            correct: 1,
            explanation:
              "The Tropic of Cancer (23°30' N) passes almost halfway through India, dividing the country roughly into a northern (temperate) part and a southern (tropical) part.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Due to India's east-west longitudinal extent of about 29°, there is a difference of roughly how much time between its easternmost and westernmost points?",
            options: ["30 minutes", "1 hour", "2 hours", "3 hours"],
            correct: 2,
            explanation:
              "Since local time changes by 4 minutes for every degree of longitude, a longitudinal spread of about 29° creates a time difference of roughly two hours between India's eastern (Arunachal Pradesh) and western (Gujarat) extremities — which is why the Sun rises about two hours earlier in the east.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which of the following is the correct number of countries sharing a land boundary with India, as given in the NCERT Class VI text?",
            options: ["Five", "Six", "Seven", "Eight"],
            correct: 2,
            explanation:
              "Seven countries share land boundaries with India: Pakistan, Afghanistan, China, Nepal, Bhutan, Myanmar and Bangladesh. Sri Lanka and Maldives are India's island neighbours, separated by sea (Sri Lanka by the Palk Strait).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Sri Lanka is separated from India by which strait?",
            options: ["Palk Strait", "Bering Strait", "Strait of Malacca", "Ten Degree Channel"],
            correct: 0,
            explanation:
              "Sri Lanka, India's southern island neighbour, is separated from the Indian mainland by the Palk Strait.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "As per the NCERT Class VI textbook (which notes Telangana became the 29th state in June 2014), India is divided into how many States and Union Territories?",
            options: ["28 States and 8 UTs", "29 States and 7 Union Territories", "30 States and 6 UTs", "27 States and 9 UTs"],
            correct: 1,
            explanation:
              "For administrative purposes, India (as per this edition of the textbook) is divided into 29 States and 7 Union Territories. Telangana, carved out of Andhra Pradesh, became the 29th state on 2 June 2014.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which is the largest state of India in terms of area, and which is the smallest, as per the textbook?",
            options: [
              "Largest: Madhya Pradesh; Smallest: Sikkim",
              "Largest: Rajasthan; Smallest: Goa",
              "Largest: Uttar Pradesh; Smallest: Tripura",
              "Largest: Maharashtra; Smallest: Kerala",
            ],
            correct: 1,
            explanation:
              "Rajasthan is the largest state of India by area, while Goa is the smallest state by area, as stated in the textbook.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Himalayas are divided into three main parallel ranges. Which is the northernmost range, home to the world's highest peaks?",
            options: ["Shiwalik", "Himachal (Middle Himalaya)", "Himadri (Great Himalaya)", "Purvanchal"],
            correct: 2,
            explanation:
              "The Himalayas consist of three parallel ranges: the Himadri (Great Himalaya) in the north, containing the world's highest peaks; the Himachal (Middle Himalaya), where many hill stations are located; and the Shiwalik, the southernmost range.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Northern Indian Plains, lying south of the Himalayas, are formed mainly by the alluvial deposits of which rivers?",
            options: [
              "The Narmada and the Tapi",
              "The Godavari and the Krishna",
              "The Indus, the Ganga, the Brahmaputra and their tributaries",
              "The Mahanadi and the Kaveri",
            ],
            correct: 2,
            explanation:
              "The Northern Plains are formed by alluvial deposits laid down by the Indus, the Ganga, the Brahmaputra and their tributaries, making them extremely fertile and densely populated.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Narmada and the Tapi are important west-flowing rivers of the Peninsular Plateau. Into which water body do they drain?",
            options: ["Bay of Bengal", "Arabian Sea", "Indian Ocean directly", "Palk Strait"],
            correct: 1,
            explanation:
              "Unlike most Peninsular rivers, the Narmada and the Tapi flow westward through the Vindhya and Satpura ranges and drain into the Arabian Sea.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which range of mountains forms the western border of the Peninsular Plateau and is also known as the Sahyadris?",
            options: ["Eastern Ghats", "Vindhya Range", "Western Ghats", "Aravali Range"],
            correct: 2,
            explanation:
              "The Western Ghats, also known as the Sahyadris, form the western edge of the Peninsular Plateau and are almost continuous, whereas the Eastern Ghats (on the eastern edge) are broken and uneven.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Sunderbans, the world's largest delta, is formed at the mouth of which two rivers as they enter the Bay of Bengal?",
            options: [
              "The Godavari and the Krishna",
              "The Ganga and the Brahmaputra",
              "The Mahanadi and the Kaveri",
              "The Indus and the Sutlej",
            ],
            correct: 1,
            explanation:
              "The Ganga and the Brahmaputra together form the Sunderbans Delta — the world's largest delta — as they enter the Bay of Bengal, spanning parts of West Bengal (India) and Bangladesh.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Lakshadweep Islands, located off the coast of Kerala in the Arabian Sea, are formed of:",
            options: ["Volcanic rock", "Coral", "Glacial deposits", "Sedimentary sandstone only"],
            correct: 1,
            explanation:
              "Lakshadweep Islands are coral islands, formed from the skeletons of tiny marine animals called polyps that build up over time as new polyps grow on the hardened skeletons of earlier ones.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Andaman and Nicobar Islands are located in which water body, to the southeast of the Indian mainland?",
            options: ["Arabian Sea", "Bay of Bengal", "Indian Ocean (open waters, not a specific sea)", "Persian Gulf"],
            correct: 1,
            explanation:
              "The Andaman and Nicobar Islands lie in the Bay of Bengal, to the southeast of the Indian mainland, distinct from the coral Lakshadweep Islands, which lie in the Arabian Sea off Kerala.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "india-climate-vegetation-and-wildlife",
        name: "India: Climate, Vegetation and Wildlife",
        questions: [
          q({
            text: "Which of the following correctly matches an Indian season with its typical months?",
            options: [
              "Cold Weather Season: June to September",
              "Hot Weather Season: March to May",
              "Southwest Monsoon Season: December to February",
              "Season of Retreating Monsoon: March to May",
            ],
            correct: 1,
            explanation:
              "India's four broad seasons are: Cold Weather Season/Winter (December–February), Hot Weather Season/Summer (March–May), Southwest Monsoon/Rainy Season (June–September), and the Season of Retreating Monsoon/Autumn (October–November).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The hot, dry winds that blow during the day in the hot weather season in northern India are known as:",
            options: ["Loo", "Monsoon", "Doldrums", "Trade winds"],
            correct: 0,
            explanation:
              "'Loo' refers to the hot and dry winds that blow during the day across northern India in the summer (hot weather) season, often causing heat-related illnesses.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The term 'monsoon', used to describe India's climate, is derived from which language and what does it originally mean?",
            options: [
              "Sanskrit, meaning 'rain'",
              "Arabic word 'mausim', meaning 'season'",
              "Greek, meaning 'wind'",
              "Persian, meaning 'cloud'",
            ],
            correct: 1,
            explanation:
              "The word 'monsoon' comes from the Arabic word 'mausim', meaning 'season'. India's climate is broadly classified as the Monsoon type, since most rainfall is brought by seasonal monsoon winds.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the Southwest Monsoon season, from which direction do the rain-bearing winds blow?",
            options: [
              "From the land towards the Arabian Sea and Bay of Bengal",
              "From the Arabian Sea and Bay of Bengal towards the land",
              "From the Himalayas towards the plains only",
              "From the North Pole towards the equator",
            ],
            correct: 1,
            explanation:
              "During the Southwest Monsoon (rainy) season, moisture-laden winds blow from the Arabian Sea and the Bay of Bengal towards the land. When these winds strike mountain barriers, they cause rainfall.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "During the Season of Retreating Monsoon (October–November), which parts of India particularly receive rainfall as winds move back from the mainland towards the Bay of Bengal?",
            options: [
              "Punjab and Haryana",
              "Rajasthan and Gujarat",
              "Tamil Nadu and Andhra Pradesh",
              "Jammu and Kashmir",
            ],
            correct: 2,
            explanation:
              "In the retreating monsoon season, winds move back from the mainland to the Bay of Bengal, and the southern parts of India — particularly Tamil Nadu and Andhra Pradesh — receive rainfall during this period.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mawsynram, which receives the world's highest rainfall, is located in which Indian state?",
            options: ["Assam", "Meghalaya", "Kerala", "Sikkim"],
            correct: 1,
            explanation:
              "Mawsynram, in Meghalaya, is recorded as receiving the highest average annual rainfall in the world, in sharp contrast to places like Jaisalmer in Rajasthan, which may sometimes receive no rain at all in a given year.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is NOT one of the factors that the textbook identifies as affecting the climate of a place?",
            options: ["Location", "Altitude", "Distance from the sea", "Political boundaries"],
            correct: 3,
            explanation:
              "The climate of a place is affected by its location, altitude, distance from the sea, and relief — not by political boundaries, which explains why India shows great regional climatic diversity, from the freezing cold of Drass/Kargil to the hot desert of Jaisalmer/Bikaner.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which type of forest, found in areas of heavy rainfall, is so dense that sunlight does not reach the ground, and includes trees like mahogany, ebony and rosewood?",
            options: ["Tropical Deciduous Forest", "Thorny Bush vegetation", "Tropical (Evergreen) Rain Forest", "Mountain Vegetation"],
            correct: 2,
            explanation:
              "Tropical (Evergreen) Rain Forests grow in areas of heavy rainfall and are so dense that sunlight cannot reach the ground. They remain green year-round because different trees shed leaves at different times, and include species like mahogany, ebony and rosewood, found in the Andaman & Nicobar Islands, parts of North-East India, and the western slopes of the Western Ghats.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tropical Deciduous Forests, which cover a large part of India and shed their leaves at a particular time of year, are also known as:",
            options: ["Rain forests", "Monsoon forests", "Thorny forests", "Mangrove forests"],
            correct: 1,
            explanation:
              "Tropical Deciduous Forests are also called Monsoon Forests. They are less dense than evergreen forests, shed leaves at a specific time of year, and include trees like sal, teak, peepal, neem and shisham, found in states like Madhya Pradesh, Uttar Pradesh, Bihar and Chhattisgarh.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In which type of vegetation zone do plants have leaves modified into spines (like cactus, babool and keekar) to reduce water loss, typically found in Rajasthan and Gujarat?",
            options: ["Mangrove forest", "Mountain vegetation", "Thorny bushes", "Tropical evergreen forest"],
            correct: 2,
            explanation:
              "Thorny bush vegetation is found in the dry areas of India (Rajasthan, Punjab, Haryana, Gujarat, and the eastern slopes of the Western Ghats). To reduce water loss, leaves are modified into spines, as seen in cactus, khair, babool and keekar.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Coniferous trees such as Chir, Pine and Deodar, found at heights between 1,500 and 2,500 metres, are characteristic of which vegetation type?",
            options: ["Mangrove forests", "Mountain vegetation", "Thorny bushes", "Tropical deciduous forests"],
            correct: 1,
            explanation:
              "Mountain vegetation varies with altitude; as height increases, temperature falls, and between 1,500 and 2,500 metres, conical (coniferous) trees like Chir, Pine and Deodar dominate.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mangrove forests, which can survive in saline water and are found mainly in the Sunderbans and the Andaman & Nicobar Islands, are named after which well-known tree species?",
            options: ["Sal", "Sundari", "Teak", "Deodar"],
            correct: 1,
            explanation:
              "'Sundari' is a well-known tree species found in mangrove forests, after which the Sunderbans (in West Bengal and the Andaman & Nicobar Islands) are named. Mangroves are unique in their ability to thrive in saline (salty) water.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which forest in Gujarat is famous as the home of the Asiatic lion?",
            options: ["Sunderbans", "Gir Forest", "Corbett Forest", "Kanha Forest"],
            correct: 1,
            explanation:
              "The Gir Forest in Gujarat is the natural home of the Asiatic lion. Elephants and the one-horned rhinoceros, meanwhile, are found in the forests of Assam.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "India's national animal and national bird are respectively:",
            options: [
              "Lion and Peacock",
              "Tiger and Peacock",
              "Tiger and Parrot",
              "Elephant and Peacock",
            ],
            correct: 1,
            explanation:
              "The tiger is India's national animal, found across various parts of the country, while the peacock is India's national bird. Government conservation efforts for wildlife include Project Tiger and Project Elephant.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "environment",
        name: "Environment",
        questions: [
          q({
            text: "In geography, the term 'environment' refers to:",
            options: [
              "Only the natural surroundings such as mountains and rivers",
              "Only human-made structures like roads and buildings",
              "The sum total of all natural and human-made surroundings that affect living organisms",
              "Only the atmosphere surrounding the earth",
            ],
            correct: 2,
            explanation:
              "Environment is a combination of natural and human-made phenomena. It includes everything — land, water, air, living organisms and human creations — that surrounds a living organism and with which it interacts.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The word 'Environment' is derived from which language, and what does it originally mean?",
            options: [
              "Latin word 'Ignis', meaning fire",
              "French word 'Environer/Environner', meaning neighbourhood",
              "Greek word 'metamorphose', meaning change of form",
              "Latin word 'sedimentum', meaning settle down",
            ],
            correct: 1,
            explanation:
              "The chapter's Word Origin box states that 'Environment' comes from the French word Environer/Environner, meaning 'neighbourhood'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following are the four major natural domains (components) of the environment?",
            options: [
              "Lithosphere, Hydrosphere, Atmosphere, Biosphere",
              "Crust, Mantle, Core, Atmosphere",
              "Troposphere, Stratosphere, Mesosphere, Exosphere",
              "Rural, Urban, Industrial, Agricultural",
            ],
            correct: 0,
            explanation:
              "The natural environment is made up of four domains: the lithosphere (land), hydrosphere (water), atmosphere (air) and biosphere (living things).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Lithosphere is best described as:",
            options: [
              "The thin layer of air surrounding the earth",
              "The solid crust or hard top layer of the earth made up of rocks and minerals",
              "The domain of water comprising rivers, lakes and oceans",
              "The narrow zone where land, water and air interact to support life",
            ],
            correct: 1,
            explanation:
              "Lithosphere is the solid crust or hard top layer of the earth, made up of rocks and minerals, covered by a thin layer of soil, with landforms such as mountains, plateaus, plains and valleys.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of these is NOT a natural ecosystem?",
            options: ["Desert", "Aquarium", "Forest", "Grassland"],
            correct: 1,
            explanation:
              "An aquarium is an artificial, human-made enclosure, unlike a desert, forest or grassland, which are natural ecosystems.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "An 'ecosystem' is best defined as:",
            options: [
              "A system formed only of human-made buildings and roads",
              "The relationship between living organisms and each other, and between organisms and their surroundings",
              "The layer of gases surrounding the earth",
              "The process of transformation of rocks from one type to another",
            ],
            correct: 1,
            explanation:
              "An ecosystem is formed by the relation between living organisms as well as the relation between organisms and their surroundings — it can be as large as a rainforest or as small as a pond.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "World Environment Day is celebrated every year on:",
            options: ["22 March", "5 June", "22 April", "16 September"],
            correct: 1,
            explanation:
              "The chapter notes that World Environment Day is celebrated on 5 June every year (distinct from World Water Day on 22 March).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is an example of human (man-made) environment rather than natural environment?",
            options: ["Mountains", "Rivers", "Roads and bridges", "Trees"],
            correct: 2,
            explanation:
              "Roads and bridges are creations of human beings, whereas mountains, rivers and trees are created by nature and form the natural environment.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The two broad categories into which all elements of the natural environment can be divided are:",
            options: [
              "Rural and Urban",
              "Biotic and Abiotic",
              "Permanent and Temporary",
              "Renewable and Non-renewable",
            ],
            correct: 1,
            explanation:
              "Biotic elements are the world of living organisms such as plants and animals, while abiotic elements are the world of non-living things such as land.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the chapter, human beings modify their natural environment mainly because:",
            options: [
              "Of a decrease in population",
              "Their needs keep growing and becoming more varied",
              "Natural resources are unlimited",
              "Animals compete with them for resources",
            ],
            correct: 1,
            explanation:
              "As explained in the chapter's opening conversation, environment changes because human needs are increasing day by day, leading people to modify and sometimes destroy natural surroundings.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which system of trade, in which goods are exchanged without the use of money, emerged as human needs grew?",
            options: ["Barter system", "Banking system", "Stock exchange", "Currency system"],
            correct: 0,
            explanation:
              "The Barter System is a trade in which goods are exchanged without the use of money — it emerged as humans learned to grow crops, domesticate animals and produce surplus food.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The 'biosphere' refers to:",
            options: [
              "The solid crust of the earth",
              "The domain of water",
              "The thin layer of air around the earth",
              "The narrow zone of the earth where land, water and air interact to support life, comprising the plant and animal kingdom",
            ],
            correct: 3,
            explanation:
              "The biosphere is the narrow zone of the earth where land, water and air interact to support life; it is made up of the plant and animal kingdom together, also called the living world.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following statements about the atmosphere is correct?",
            options: [
              "It is held around the earth by the gravitational force of the earth",
              "It is composed only of oxygen and water vapour",
              "It has no role in determining weather and climate",
              "It is the same as the biosphere",
            ],
            correct: 0,
            explanation:
              "The atmosphere, a thin blanket of air, gases, dust and water vapour, is held around the earth by its gravitational force, and changes in it produce changes in weather and climate.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the chapter's matching exercise, 'Environment' is correctly matched with which description?",
            options: [
              "Our surroundings",
              "Domain of water",
              "Blanket of air around the earth",
              "Gravitational force of the earth",
            ],
            correct: 0,
            explanation:
              "In the chapter's match-the-following exercise, 'Environment' is matched with 'our surroundings', while 'Hydrosphere' is domain of water and 'Atmosphere' is the blanket of air.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following can form an ecosystem, according to the examples given in the chapter?",
            options: [
              "Only large rainforests",
              "A large rainforest, grassland, desert, mountain, lake, river, ocean, or even a small pond",
              "Only oceans",
              "Only deserts",
            ],
            correct: 1,
            explanation:
              "The chapter notes there could be an ecosystem of a large rainforest, grassland, desert, mountains, lake, river, ocean and even a small pond.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "inside-our-earth",
        name: "Inside Our Earth",
        questions: [
          q({
            text: "What are the three main layers of the earth's interior, from outermost to innermost?",
            options: [
              "Crust, Mantle, Core",
              "Sial, Sima, Nife",
              "Igneous, Sedimentary, Metamorphic",
              "Troposphere, Stratosphere, Mesosphere",
            ],
            correct: 0,
            explanation:
              "Like an onion, the earth is made of concentric layers: the crust (outermost), the mantle, and the core (innermost).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The continental crust, composed mainly of silica and alumina, is also known as:",
            options: ["Sima", "Sial", "Nife", "Regolith"],
            correct: 1,
            explanation:
              "The continental crust is called 'sial' — si for silica and al for alumina — its main mineral constituents.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The oceanic crust, composed mainly of silica and magnesium, is known as:",
            options: ["Sial", "Sima", "Nife", "Mantle"],
            correct: 1,
            explanation:
              "The oceanic crust is called 'sima' — si for silica and ma for magnesium.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Approximately what percentage of the earth's volume is made up by the mantle?",
            options: ["1%", "15%", "84%", "50%"],
            correct: 2,
            explanation:
              "The crust forms only 1% of the earth's volume, the mantle makes up 84%, and the core makes up the remaining 15%.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The innermost layer of the earth, made mainly of nickel and iron, is called:",
            options: ["Sial", "Sima", "Nife", "Mantle"],
            correct: 2,
            explanation:
              "The core, with a radius of about 3,500 km, is mainly made up of nickel (ni) and iron/ferrous (fe), hence it is called 'nife'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Rocks formed when molten magma cools and becomes solid are called:",
            options: ["Sedimentary rocks", "Igneous rocks", "Metamorphic rocks", "Fossil rocks"],
            correct: 1,
            explanation:
              "When molten magma cools, it becomes solid, forming igneous rocks — also called primary rocks.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Basalt, the rock that makes up the Deccan Plateau, is an example of:",
            options: [
              "Intrusive igneous rock",
              "Extrusive igneous rock",
              "Sedimentary rock",
              "Metamorphic rock",
            ],
            correct: 1,
            explanation:
              "When lava cools rapidly on the earth's surface, it forms fine-grained extrusive igneous rocks such as basalt, which makes up the Deccan Plateau.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Granite, formed when molten magma cools slowly deep inside the earth's crust, is an example of:",
            options: [
              "Extrusive igneous rock",
              "Intrusive igneous rock",
              "Sedimentary rock",
              "Metamorphic rock",
            ],
            correct: 1,
            explanation:
              "Magma that cools slowly deep inside the crust forms large-grained intrusive igneous rocks such as granite, used for grinding stones.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rocks formed from compressed and hardened sediments, such as sandstone, and which may contain fossils, are called:",
            options: [
              "Igneous rocks",
              "Sedimentary rocks",
              "Metamorphic rocks",
              "Intrusive rocks",
            ],
            correct: 1,
            explanation:
              "Loose sediments transported by wind and water are compressed and hardened into layers of sedimentary rock, such as sandstone, which may contain fossils.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Under great heat and pressure, limestone changes into marble and clay changes into slate. This transformation produces:",
            options: ["Igneous rocks", "Sedimentary rocks", "Metamorphic rocks", "Fossil rocks"],
            correct: 2,
            explanation:
              "Igneous and sedimentary rocks change into metamorphic rocks under great heat and pressure — for example, limestone becomes marble and clay becomes slate.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The cyclic process by which one type of rock transforms into another (igneous to sedimentary to metamorphic and back to magma) is called:",
            options: ["The water cycle", "The rock cycle", "Weathering", "Erosion"],
            correct: 1,
            explanation:
              "This process of transformation of rock from one type to another in a cyclic manner is known as the rock cycle.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A mineral is best defined as:",
            options: [
              "Any natural mass of mineral matter making up the earth's crust, regardless of composition",
              "A naturally occurring substance with certain physical properties and a definite chemical composition",
              "A rock formed only from cooled magma",
              "A layer of the atmosphere",
            ],
            correct: 1,
            explanation:
              "Minerals are naturally occurring substances that have certain physical properties and a definite chemical composition, unlike rocks, which are made up of different minerals.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the chapter, which rocks were used to build these two famous monuments — the Red Fort and the Taj Mahal?",
            options: [
              "Red Fort — granite; Taj Mahal — basalt",
              "Red Fort — red sandstone; Taj Mahal — white marble",
              "Red Fort — slate; Taj Mahal — limestone",
              "Red Fort — sandstone; Taj Mahal — granite",
            ],
            correct: 1,
            explanation:
              "The chapter's activity notes that the Red Fort is made of red sandstone (a sedimentary rock) while the Taj Mahal is made of white marble (a metamorphic rock).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Coal, natural gas and petroleum are minerals that are primarily used as:",
            options: ["Fuels", "Building material", "Fertilisers", "Ornaments"],
            correct: 0,
            explanation:
              "The chapter lists coal, natural gas and petroleum as minerals used as fuels, while others are used in industry, medicine, fertilisers and jewellery.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the earth's layers is the thinnest?",
            options: ["Core", "Mantle", "Crust", "Asthenosphere"],
            correct: 2,
            explanation:
              "The crust is the thinnest of all the earth's layers — about 35 km on continental masses and only about 5 km on ocean floors.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The mantle extends from just below the crust to a depth of approximately:",
            options: ["100 km", "900 km", "2,900 km", "6,371 km"],
            correct: 2,
            explanation:
              "The mantle lies just beneath the crust and extends to a depth of about 2,900 km below the crust.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "our-changing-earth",
        name: "Our Changing Earth",
        questions: [
          q({
            text: "Forces that act in the interior of the earth and cause earth movements are called:",
            options: [
              "Exogenic forces",
              "Endogenic forces",
              "Erosional forces",
              "Depositional forces",
            ],
            correct: 1,
            explanation:
              "Endogenic forces act in the interior of the earth and produce sudden movements (earthquakes, volcanoes) as well as slow diastrophic movements (mountain building).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Forces such as running water, wind, sea waves and glaciers that work on the surface of the earth, causing erosion and deposition, are called:",
            options: [
              "Endogenic forces",
              "Diastrophic forces",
              "Exogenic forces",
              "Seismic forces",
            ],
            correct: 2,
            explanation:
              "Exogenic forces work on the surface of the earth and include erosional and depositional agents like rivers, wind, sea waves and glaciers.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "During an earthquake, the place in the earth's crust where the movement originates is called the ___, while the point on the surface directly above it is called the ___.",
            options: [
              "Epicentre; Focus",
              "Focus; Epicentre",
              "Crater; Vent",
              "Vent; Crater",
            ],
            correct: 1,
            explanation:
              "The focus is where the earthquake's seismic energy originates in the crust, and the epicentre is the point on the surface directly above the focus.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "An earthquake's magnitude is measured on the:",
            options: ["Beaufort scale", "Richter scale", "Celsius scale", "Fujita scale"],
            correct: 1,
            explanation:
              "An earthquake is measured with a machine called a seismograph, and its magnitude is expressed on the Richter scale.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The massive earthquake that hit Bhuj, Gujarat, on 26 January 2001 measured how much on the Richter scale?",
            options: ["5.2", "6.9", "8.1", "9.0"],
            correct: 1,
            explanation:
              "The Bhuj earthquake of 26 January 2001 measured 6.9 on the Richter scale and caused massive destruction, described as a case study in the chapter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A vent (opening) in the earth's crust through which molten material erupts suddenly is called a:",
            options: ["Geyser", "Volcano", "Glacier", "Delta"],
            correct: 1,
            explanation:
              "A volcano is a vent in the earth's crust through which molten material (magma, lava, gases and ash) erupts suddenly.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "When a river tumbles at a steep angle over hard rocks or down a steep valley side, it forms a:",
            options: ["Meander", "Waterfall", "Ox-bow lake", "Delta"],
            correct: 1,
            explanation:
              "A waterfall forms when running water in a river drops suddenly over hard rock or a steep valley side.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Large bends formed by a river as it twists and turns while entering a plain are called:",
            options: ["Levees", "Meanders", "Deltas", "Sand dunes"],
            correct: 1,
            explanation:
              "As a river enters the plain, it twists and turns forming large bends known as meanders, caused by continuous erosion and deposition.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "When a meander loop is cut off from the main river over time, it forms a:",
            options: ["Delta", "Ox-bow lake", "Flood plain", "Sea arch"],
            correct: 1,
            explanation:
              "In due course, a meander loop cuts off from the river, forming a cut-off lake also called an ox-bow lake.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The raised banks formed along a river's course due to deposition of sediments during floods are called:",
            options: ["Levees", "Deltas", "Distributaries", "Moraines"],
            correct: 0,
            explanation:
              "During flooding, deposited layers of fine soil form a fertile floodplain, and the raised banks along it are called levees.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "As a river approaches the sea and breaks up into a number of smaller streams, each of these streams is called a:",
            options: ["Tributary", "Distributary", "Meander", "Levee"],
            correct: 1,
            explanation:
              "Near the sea, the river slows down and breaks into a number of streams called distributaries, each forming its own mouth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The collection of sediments deposited at the mouths of distributaries near a river's end forms a:",
            options: ["Delta", "Ox-bow lake", "Sand dune", "Sea cliff"],
            correct: 0,
            explanation:
              "The collection of sediments from all the mouths of a river's distributaries forms a delta.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Erosion by sea waves that widens cracks in rocks into hollow openings creates:",
            options: ["Sea cliffs", "Sea caves", "Sand dunes", "Levees"],
            correct: 1,
            explanation:
              "As sea waves continuously strike rocks, cracks develop and widen over time into hollow openings called sea caves.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "When the roof of a sea cave collapses, leaving only wall-like features standing in the sea, these are called:",
            options: ["Sea arches", "Stacks", "Beaches", "Deltas"],
            correct: 1,
            explanation:
              "As sea caves grow bigger, only the roof remains, forming sea arches; further erosion breaks the roof, leaving only wall-like features called stacks.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rocks in the desert with a narrower base and wider top, shaped like a mushroom, are formed mainly due to erosion by:",
            options: ["Water", "Wind", "Ice", "Sea waves"],
            correct: 1,
            explanation:
              "Wind erodes the lower section of desert rocks more than the upper part, producing 'mushroom rocks' with a narrow base and wide top.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Fine, light sand carried by wind over long distances and deposited in large quantities (with major deposits found in China) is called:",
            options: ["Moraine", "Loess", "Levee", "Delta"],
            correct: 1,
            explanation:
              "When very fine and light grains of sand are carried over long distances by wind and deposited in large areas, the deposit is called loess, with large deposits found in China.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Deposits of rocks, sand and silt carried and left behind by a melting glacier are called:",
            options: ["Sand dunes", "Glacial moraines", "Levees", "Sea stacks"],
            correct: 1,
            explanation:
              "As a glacier moves and melts, the material it carries — rocks, sand and silt — gets deposited, forming glacial moraines.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "air",
        name: "Air",
        questions: [
          q({
            text: "Which two gases together make up the bulk (about 99%) of the earth's atmosphere?",
            options: [
              "Oxygen and Carbon dioxide",
              "Nitrogen and Oxygen",
              "Nitrogen and Carbon dioxide",
              "Oxygen and Ozone",
            ],
            correct: 1,
            explanation:
              "Nitrogen and oxygen are the two gases that make up the bulk of the atmosphere, with carbon dioxide, helium, ozone, argon and hydrogen found in much smaller quantities.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which gas, though present only in a small amount, traps heat radiated from the earth and is responsible for the greenhouse effect?",
            options: ["Nitrogen", "Oxygen", "Carbon dioxide", "Argon"],
            correct: 2,
            explanation:
              "Carbon dioxide traps heat radiated from the earth, producing the greenhouse effect; its increase due to burning fuels contributes to global warming.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which layer of the atmosphere, extending to an average height of about 13 km, is where almost all weather phenomena such as rainfall, fog and hailstorms occur?",
            options: ["Stratosphere", "Troposphere", "Mesosphere", "Thermosphere"],
            correct: 1,
            explanation:
              "The troposphere is the most important, lowest layer of the atmosphere, with an average height of 13 km, where nearly all weather phenomena occur.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The stratosphere, which contains the ozone layer and is nearly free of clouds, is considered ideal for:",
            options: [
              "Radio transmission",
              "Flying aeroplanes",
              "Meteorites to burn up",
              "Rainfall formation",
            ],
            correct: 1,
            explanation:
              "The stratosphere extends up to 50 km, is almost free from clouds and weather phenomena, making it ideal for flying aeroplanes, and it contains the protective ozone layer.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In which layer of the atmosphere do meteorites entering from space typically burn up?",
            options: ["Troposphere", "Stratosphere", "Mesosphere", "Exosphere"],
            correct: 2,
            explanation:
              "The mesosphere, the third layer extending up to about 80 km, is where meteorites from space burn up upon entry.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The ionosphere, which helps in radio transmission by reflecting radio waves back to earth, is part of which layer?",
            options: ["Stratosphere", "Mesosphere", "Thermosphere", "Exosphere"],
            correct: 2,
            explanation:
              "The ionosphere is part of the thermosphere (extending between 80-400 km), and it helps in radio transmission by reflecting radio waves back to earth.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Light gases such as helium and hydrogen escape into space from which uppermost, thinnest layer of the atmosphere?",
            options: ["Thermosphere", "Mesosphere", "Exosphere", "Troposphere"],
            correct: 2,
            explanation:
              "The exosphere is the uppermost layer of the atmosphere with very thin air, from which light gases like helium and hydrogen float into space.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The difference between 'weather' and 'climate' is best described as:",
            options: [
              "Weather and climate mean the same thing",
              "Weather is the hour-to-hour/day-to-day condition of the atmosphere, while climate is the average weather of a place over a long period",
              "Climate changes daily while weather stays the same for years",
              "Weather refers only to temperature, while climate refers only to rainfall",
            ],
            correct: 1,
            explanation:
              "Weather is the hour-to-hour, day-to-day condition of the atmosphere, while climate is the average weather condition of a place over a longer period of time.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Insolation, the incoming solar energy intercepted by the earth, generally:",
            options: [
              "Increases from the equator towards the poles",
              "Decreases from the equator towards the poles",
              "Remains constant everywhere on earth",
              "Is highest at the poles",
            ],
            correct: 1,
            explanation:
              "The amount of insolation decreases from the equator towards the poles, which is why temperature also decreases in the same manner and poles remain covered with snow.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Air pressure, the pressure exerted by the weight of air on the earth's surface, is:",
            options: [
              "Lowest at sea level and increases with height",
              "Highest at sea level and decreases with height",
              "The same at all heights",
              "Unrelated to temperature",
            ],
            correct: 1,
            explanation:
              "Air pressure is highest at sea level and falls rapidly as we go up through the layers of the atmosphere.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Permanent winds that blow constantly throughout the year in a particular direction include the trade winds, westerlies and:",
            options: ["Monsoons", "Land and sea breeze", "Easterlies", "Loo"],
            correct: 2,
            explanation:
              "The trade winds, westerlies and easterlies are the three permanent winds that blow constantly throughout the year in a particular direction.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is an example of a seasonal wind mentioned in the chapter?",
            options: ["Trade winds", "Westerlies", "Monsoons in India", "Easterlies"],
            correct: 2,
            explanation:
              "Seasonal winds change their direction in different seasons; monsoons in India are given as the chapter's example of a seasonal wind.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Local winds that blow only during a particular period of the day or year in a small area include which of the following pairs?",
            options: [
              "Trade winds and westerlies",
              "Land breeze and sea breeze",
              "Monsoons and cyclones",
              "Easterlies and polar winds",
            ],
            correct: 1,
            explanation:
              "Land and sea breeze are examples of local winds, which blow only during a particular period of the day or year in a small area — the hot, dry 'loo' of northern India is another example.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The 1999 supercyclone that devastated Odisha originated as a depression near which location?",
            options: [
              "Bay of Bengal near Chennai",
              "Gulf of Thailand near Port Blair",
              "Arabian Sea near Mumbai",
              "Indian Ocean near Sri Lanka",
            ],
            correct: 1,
            explanation:
              "The chapter's case study notes the cyclone originated as a depression in the Gulf of Thailand near east of Port Blair on 25 October 1999, later hitting Odisha as a supercyclone.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Moisture in the air at any given time is referred to as:",
            options: ["Precipitation", "Humidity", "Insolation", "Condensation"],
            correct: 1,
            explanation:
              "Humidity is the moisture in the air at any time; on a humid day, clothes take longer to dry and sweat does not evaporate easily.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "On the basis of mechanism, rainfall is classified into convectional, orographic (relief) and which third type?",
            options: [
              "Frontal rainfall",
              "Cyclonic rainfall",
              "Monsoon rainfall",
              "Acid rainfall",
            ],
            correct: 1,
            explanation:
              "The chapter classifies rainfall into three types based on mechanism: convectional rainfall, orographic (relief) rainfall, and cyclonic rainfall.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Precipitation that reaches the earth's surface in liquid form is called:",
            options: ["Snow", "Hail", "Rain", "Sleet"],
            correct: 2,
            explanation:
              "Precipitation coming down to earth in liquid form is called rain; snow, sleet and hail are other forms of precipitation.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "water",
        name: "Water",
        questions: [
          q({
            text: "The continuous process by which water changes its form and circulates between the oceans, atmosphere and land is called:",
            options: ["The rock cycle", "The water cycle", "The carbon cycle", "The nitrogen cycle"],
            correct: 1,
            explanation:
              "The water cycle is the process by which water continually changes its form and circulates between oceans, the atmosphere and land through evaporation, condensation and precipitation.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Approximately what percentage of the total water on earth is found in the oceans as saline water?",
            options: ["50%", "75%", "97.3%", "2.7%"],
            correct: 2,
            explanation:
              "According to the chapter's distribution table, oceans hold about 97.3% of the earth's total water as saline water, leaving only a small share as fresh water.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After ocean/saline water, the next largest share of the earth's total water is locked up as:",
            options: [
              "River water",
              "Groundwater",
              "Ice caps and glaciers",
              "Atmospheric moisture",
            ],
            correct: 2,
            explanation:
              "After the 97.3% saline ocean water, ice caps hold the next largest share of the earth's water (about 2%), followed by much smaller shares of groundwater, lakes, rivers and atmospheric moisture.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Salinity is defined as:",
            options: [
              "The temperature of ocean water",
              "The amount of salt (in grams) present in 1,000 grams of water",
              "The depth of the ocean floor",
              "The speed of ocean currents",
            ],
            correct: 1,
            explanation:
              "Salinity is the amount of salt in grams present in 1,000 grams of water; the average salinity of the oceans is 35 parts per thousand.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which sea is famous for having such high salinity (340 grams of salt per litre) that swimmers can easily float on it?",
            options: ["Red Sea", "Dead Sea", "Caspian Sea", "Arabian Sea"],
            correct: 1,
            explanation:
              "The Dead Sea in Israel has a salinity of 340 grams per litre of water — the high salt content makes the water dense enough for swimmers to float.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The three broad movements of ocean water described in the chapter are waves, currents and:",
            options: ["Monsoons", "Tides", "Cyclones", "Deltas"],
            correct: 1,
            explanation:
              "The movements that occur in oceans are broadly categorised as waves, tides and currents.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "A huge, highly destructive sea wave caused by an undersea earthquake, volcanic eruption or landslide is called a:",
            options: ["Tide", "Current", "Tsunami", "Monsoon"],
            correct: 2,
            explanation:
              "A tsunami — a Japanese word meaning 'harbour wave' — is a huge tidal wave caused by an earthquake, volcanic eruption or underwater landslide shifting large amounts of ocean water.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The devastating tsunami of 26 December 2004 in the Indian Ocean had its epicentre near which location?",
            options: ["Java", "Sumatra", "Sri Lanka", "Andaman"],
            correct: 1,
            explanation:
              "The 2004 tsunami resulted from an earthquake with its epicentre close to the western boundary of Sumatra, measuring 9.0 on the Richter scale.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which point in the Andaman & Nicobar Islands, marking India's southernmost point, was submerged after the 2004 tsunami?",
            options: ["Kanyakumari", "Indira Point", "Point Calimere", "Rameswaram"],
            correct: 1,
            explanation:
              "Indira Point in the Andaman and Nicobar Islands, which marked the southernmost point of India, got completely submerged after the 2004 tsunami.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The rhythmic rise and fall of ocean water twice a day is called:",
            options: ["A wave", "A tide", "A current", "A tsunami"],
            correct: 1,
            explanation:
              "A tide is the rhythmic rise and fall of ocean water twice in a day, giving high tide when water rises to its highest level and low tide when it recedes.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Tides are caused mainly by:",
            options: [
              "Winds blowing across the ocean surface",
              "The gravitational pull of the sun and the moon on the earth",
              "Underwater earthquakes",
              "Temperature differences between the poles and the equator",
            ],
            correct: 1,
            explanation:
              "The strong gravitational pull exerted by the sun and the moon on the earth's surface causes tides.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The highest tides, called spring tides, occur when the sun, moon and earth are:",
            options: [
              "At right angles to each other",
              "In the same line, during full moon and new moon",
              "Farthest apart",
              "In their first quarter only",
            ],
            correct: 1,
            explanation:
              "During full moon and new moon days, the sun, moon and earth are in the same line, producing the highest tides, called spring tides.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tides that occur when the moon is in its first and last quarter, resulting in comparatively low tides, are called:",
            options: ["Spring tides", "Neap tides", "Ebb tides", "King tides"],
            correct: 1,
            explanation:
              "When the moon is in its first and last quarter, the gravitational pull of the sun and moon act diagonally opposite, producing lower tides called neap tides.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Streams of water flowing constantly on the ocean surface in definite directions are called:",
            options: ["Tides", "Waves", "Ocean currents", "Monsoons"],
            correct: 2,
            explanation:
              "Ocean currents are streams of water flowing constantly on the ocean surface in definite directions, and may be warm or cold.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Gulf Stream and the Labrador Current are examples of which type of ocean current, respectively?",
            options: [
              "Warm current; cold current",
              "Cold current; warm current",
              "Both warm currents",
              "Both cold currents",
            ],
            correct: 0,
            explanation:
              "The Gulf Stream is a warm current, while the Labrador Current is a cold current, illustrating how warm currents generally move from the equator towards the poles and cold currents the reverse.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Areas where warm and cold ocean currents meet are significant because they:",
            options: [
              "Have no fish at all",
              "Provide the world's best fishing grounds",
              "Are always ice-free",
              "Have the highest salinity in the world",
            ],
            correct: 1,
            explanation:
              "Areas where warm and cold currents meet, such as the seas around Japan and the eastern coast of North America, provide the best fishing grounds in the world, though they can also cause foggy conditions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "World Water Day, which reinforces the need to conserve water, is observed every year on:",
            options: ["5 June", "22 March", "16 September", "2 October"],
            correct: 1,
            explanation:
              "World Water Day is celebrated on 22 March every year to reinforce the need to conserve water in different ways.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "natural-vegetation-and-wildlife-world",
        name: "Natural Vegetation and Wildlife (World)",
        questions: [
          q({
            text: "Natural vegetation is broadly classified into three categories: forests, shrubs and:",
            options: ["Deserts", "Grasslands", "Wetlands", "Tundra"],
            correct: 1,
            explanation:
              "Natural vegetation is classified into forests (where temperature and rainfall support tree cover), grasslands (moderate rain) and shrubs (dry regions).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The growth of natural vegetation mainly depends on which two factors?",
            options: [
              "Soil colour and altitude only",
              "Temperature and moisture",
              "Population density and rainfall",
              "Latitude and longitude only",
            ],
            correct: 1,
            explanation:
              "The growth of vegetation depends on temperature and moisture, as well as additional factors like slope and thickness of soil.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Tropical Evergreen Forests, also called tropical rainforests, found near the equator, are characterised by:",
            options: [
              "Trees that shed all their leaves together in a dry season",
              "Thick canopies of closely spaced trees that do not let sunlight reach the ground",
              "Very sparse vegetation due to low rainfall",
              "Short grasses instead of trees",
            ],
            correct: 1,
            explanation:
              "Tropical rainforests receive heavy rainfall year-round with no dry season, so trees never shed all their leaves together, and thick canopies block sunlight from reaching the ground.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which hardwood trees are commonly found in the Tropical Evergreen Forests?",
            options: [
              "Oak, ash and beech",
              "Rosewood, ebony and mahogany",
              "Sal, teak and neem",
              "Chir, pine and cedar",
            ],
            correct: 1,
            explanation:
              "Hardwood trees like rosewood, ebony and mahogany are common in Tropical Evergreen Forests.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tropical Deciduous Forests, also known as monsoon forests, are found in large parts of India, northern Australia and Central America, and include which trees?",
            options: [
              "Pine and cedar",
              "Sal, teak, neem and shisham",
              "Oak and beech",
              "Rosewood and mahogany",
            ],
            correct: 1,
            explanation:
              "Tropical Deciduous Forests, found in regions with seasonal changes, have hardwood trees like sal, teak, neem and shisham, useful for furniture and construction.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tigers, elephants and langurs are commonly found animals of which forest type?",
            options: [
              "Coniferous forests",
              "Tropical Deciduous Forests",
              "Tundra vegetation",
              "Mediterranean vegetation",
            ],
            correct: 1,
            explanation:
              "Tigers, lions, elephants, langurs and monkeys are common animals of the Tropical Deciduous Forest regions.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Temperate Evergreen Forests, found along the eastern margins of continents (e.g. southeast USA, south China, southeast Brazil), typically contain trees such as:",
            options: [
              "Oak, pine and eucalyptus",
              "Sal and teak",
              "Cactus and acacia",
              "Mosses and lichens",
            ],
            correct: 0,
            explanation:
              "Temperate Evergreen Forests, located in mid-latitudinal coastal regions, comprise both hard and soft wood trees like oak, pine and eucalyptus.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mediterranean vegetation, found on the west and southwest margins of continents, is well known for the cultivation of:",
            options: [
              "Coniferous timber",
              "Citrus fruits such as oranges, figs, olives and grapes",
              "Rice and wheat",
              "Rubber and coffee",
            ],
            correct: 1,
            explanation:
              "Mediterranean regions, known as the 'Orchards of the world', have hot dry summers and mild rainy winters that suit citrus fruit cultivation like oranges, figs, olives and grapes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Coniferous forests, also known as Taiga, found in the higher latitudes (50°-70°N) of the Northern Hemisphere, are notable for producing softwood used mainly for:",
            options: [
              "Rice and cotton products",
              "Pulp, paper, newsprint and packing boxes",
              "Citrus fruit packaging",
              "Cash crops like tea and coffee",
            ],
            correct: 1,
            explanation:
              "Coniferous forest wood is very useful for making pulp (used for paper and newsprint), matchboxes and packing boxes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Chir, pine and cedar are common trees, while silver fox, mink and polar bear are common animals of which forest type?",
            options: [
              "Tropical Evergreen Forest",
              "Mediterranean vegetation",
              "Coniferous Forest",
              "Tropical Deciduous Forest",
            ],
            correct: 2,
            explanation:
              "Coniferous forests (Taiga) have tall softwood evergreen trees like chir, pine and cedar, with animals such as silver fox, mink and polar bear.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Tropical grasslands, found on either side of the equator, are known as Savanna in East Africa and by which name in Brazil?",
            options: ["Prairies", "Pampas", "Campos", "Steppe"],
            correct: 2,
            explanation:
              "Tropical grasslands are called Savanna in East Africa, Campos in Brazil, and Llanos in Venezuela.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following correctly matches a temperate grassland with its region?",
            options: [
              "Savanna — Africa",
              "Prairie — North America",
              "Llanos — Venezuela",
              "Campos — Brazil",
            ],
            correct: 1,
            explanation:
              "Prairie is the correct name for temperate grasslands of North America; Savanna and Llanos/Campos are names of tropical grasslands.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The temperate grassland of South Africa, known as the Veld, is located in which country?",
            options: ["Argentina", "South Africa", "Australia", "Kazakhstan (Central Asia)"],
            correct: 1,
            explanation:
              "Veld is the name given to the temperate grasslands of South Africa.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Temperate grasslands of Central Asia are called:",
            options: ["Steppe", "Downs", "Pampas", "Veld"],
            correct: 0,
            explanation:
              "Central Asia's temperate grasslands are called Steppe; Downs is the name used in Australia and Pampas in Argentina.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Elephants, zebras, giraffes and leopards are common animals of which type of grassland?",
            options: [
              "Temperate grasslands",
              "Tropical grasslands",
              "Tundra",
              "Coniferous forest",
            ],
            correct: 1,
            explanation:
              "Tropical grasslands, with tall grass growing 3-4 metres high, are home to elephants, zebras, giraffes, deer and leopards.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Tundra vegetation, found in the polar regions of Europe, Asia and North America, is dominated by:",
            options: [
              "Tall grasses",
              "Mosses, lichens and very small shrubs",
              "Hardwood trees",
              "Citrus orchards",
            ],
            correct: 1,
            explanation:
              "Tundra vegetation is very limited, consisting mainly of mosses, lichens and small shrubs that grow only during the short polar summer.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Seals, walruses, musk-oxen, arctic owls, polar bears and snow foxes are animals adapted with thick fur and skin to survive in which vegetation region?",
            options: [
              "Mediterranean region",
              "Tropical rainforest",
              "Tundra region",
              "Savanna grassland",
            ],
            correct: 2,
            explanation:
              "The animals of the Tundra region have thick fur and skin to protect themselves from the extreme cold of the polar climate.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Thorny bushes and scrubs, adapted to survive with minimal water, typically grow in:",
            options: [
              "Regions of heavy year-round rainfall",
              "Dry desert-like regions",
              "Polar regions",
              "Mid-latitude coastal regions",
            ],
            correct: 1,
            explanation:
              "Thorny shrubs and scrubs grow in dry, desert-like regions where the vegetation cover is scarce due to scanty rain and scorching heat.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "human-environment-settlement-transport-communication",
        name: "Human Environment: Settlement, Transport and Communication",
        questions: [
          q({
            text: "The specific place where a building or settlement develops is called its:",
            options: ["Site", "Locale", "Region", "Zone"],
            correct: 0,
            explanation:
              "The place where a building or a settlement develops is called its site.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is NOT listed as one of the natural conditions favourable for the selection of an ideal settlement site?",
            options: [
              "Favourable climate",
              "Availability of water",
              "Fertile soil",
              "High altitude",
            ],
            correct: 3,
            explanation:
              "The natural conditions for an ideal site are favourable climate, availability of water, suitable land and fertile soil — high altitude is not listed among them.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Ancient civilizations grew along the banks of rivers such as the Indus, Tigris, Nile and:",
            options: ["Amazon", "Hwang-He", "Mississippi", "Danube"],
            correct: 1,
            explanation:
              "Civilizations flourished along the river valleys of the Indus, Tigris, Nile and Hwang-He (Yellow River), as settlements grew near fertile, water-rich areas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Settlements occupied only for a short time, common among people practising hunting, gathering, shifting cultivation or transhumance, are called:",
            options: [
              "Permanent settlements",
              "Temporary settlements",
              "Compact settlements",
              "Urban settlements",
            ],
            correct: 1,
            explanation:
              "Temporary settlements are occupied for a short time; people living in deep forests, hot and cold deserts and mountains often dwell in such settlements.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "A rural settlement in which dwellings are closely built together wherever flat land is available is called a:",
            options: [
              "Scattered settlement",
              "Compact settlement",
              "Urban settlement",
              "Temporary settlement",
            ],
            correct: 1,
            explanation:
              "A compact settlement is a closely built area of dwellings, found wherever flat land is available.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Scattered rural settlements, where dwellings are spaced over an extensive area, are typically found in:",
            options: [
              "Densely populated plains",
              "Hilly tracts, thick forests and regions of extreme climate",
              "Coastal port cities",
              "River deltas only",
            ],
            correct: 1,
            explanation:
              "In a scattered settlement, dwellings are spaced over an extensive area — this type is mostly found in hilly tracts, thick forests and regions of extreme climate.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In regions of heavy rainfall, rural houses are typically built with:",
            options: ["Flat roofs", "Slanting roofs", "No roofs", "Underground rooms"],
            correct: 1,
            explanation:
              "In regions of heavy rainfall, houses have slanting roofs so that rainwater drains off easily.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In areas where water accumulates during the rainy season, houses are often constructed on:",
            options: [
              "Raised platforms or stilts",
              "Underground basements",
              "Permanently floating rafts",
              "Concrete bunkers",
            ],
            correct: 0,
            explanation:
              "Where water accumulates in the rainy season, houses are constructed on a raised platform or on stilts.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following are the four major means of transport described in the chapter?",
            options: [
              "Roadways, Railways, Waterways, Airways",
              "Roadways, Cycling, Walking, Airways",
              "Railways, Pipelines, Cableways, Ropeways",
              "Waterways, Airways, Space travel, Walking",
            ],
            correct: 0,
            explanation:
              "The chapter identifies four major means of transport: roadways, railways, waterways and airways.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Paved/surfaced roads are called 'metalled' (pucca) roads, while unsurfaced roads are called:",
            options: [
              "Flyovers",
              "Unmetalled (kutcha) roads",
              "Subways",
              "Expressways",
            ],
            correct: 1,
            explanation:
              "Roads can be metalled (pucca) or unmetalled (kutcha), depending on whether they are surfaced.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Manali-Leh highway is notable for being:",
            options: [
              "The longest railway line in Asia",
              "One of the highest roadways in the world",
              "An underwater tunnel",
              "The busiest port route in India",
            ],
            correct: 1,
            explanation:
              "The Manali-Leh highway in the Himalayan Mountains is described as one of the highest roadways in the world.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Roads built underground are called subways/underpasses, while roads built on raised structures above other roads are called:",
            options: ["Expressways", "Flyovers", "Highways", "Metalled roads"],
            correct: 1,
            explanation:
              "Subways or underpaths are roads built underground, while flyovers are built over raised structures.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Trans-Siberian Railway, the longest railway system in the world, connects St. Petersburg to which Pacific coast city?",
            options: ["Beijing", "Vladivostok", "Tokyo", "Shanghai"],
            correct: 1,
            explanation:
              "The Trans-Siberian Railway connects St. Petersburg in Western Russia to Vladivostok on the Pacific coast.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which country's railway network is described in the chapter as the largest in Asia?",
            options: ["China", "Japan", "India", "Russia"],
            correct: 2,
            explanation:
              "The chapter states that the Indian railway network is well developed and is the largest in Asia.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Waterways are broadly classified into inland waterways and:",
            options: ["Canal networks", "Sea routes", "River deltas", "Port channels"],
            correct: 1,
            explanation:
              "Waterways are mainly of two types: inland waterways (navigable rivers and lakes) and sea routes/oceanic routes.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is an example of an important inland waterway mentioned in the chapter?",
            options: [
              "The Suez Canal",
              "The Ganga-Brahmaputra river system",
              "The Panama Canal",
              "The Strait of Malacca",
            ],
            correct: 1,
            explanation:
              "The Ganga-Brahmaputra river system, the Great Lakes in North America, and the river Nile in Africa are given as examples of important inland waterways.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Airways, though the fastest mode of transport, are also the most expensive mainly due to:",
            options: [
              "High airport taxes",
              "High cost of fuel",
              "Lack of pilots",
              "Weather restrictions only",
            ],
            correct: 1,
            explanation:
              "Airways are the fastest way of transport but also the most expensive due to the high cost of fuel, and air traffic is adversely affected by bad weather.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In times of natural calamities, which mode of transport is described as extremely useful for rescuing people and distributing food, water, clothes and medicines to inaccessible areas?",
            options: ["Trains", "Ships", "Helicopters", "Buses"],
            correct: 2,
            explanation:
              "Helicopters are extremely useful in the most inaccessible areas and during calamities, for rescuing people and distributing essential supplies.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Newspapers, radio and television, which communicate with a large number of people, are collectively referred to as:",
            options: ["Personal media", "Mass media", "Print media only", "Digital media only"],
            correct: 1,
            explanation:
              "Newspapers, radio and television are called mass media because they communicate information to a large number of people.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Golden Quadrilateral, one of India's major expressway developments, connects Delhi, Mumbai, Chennai and:",
            options: ["Bengaluru", "Kolkata", "Hyderabad", "Pune"],
            correct: 1,
            explanation:
              "The Golden Quadrilateral is an expressway network connecting the four major cities of Delhi, Mumbai, Chennai and Kolkata.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "human-environment-interactions-tropical-subtropical",
        name: "Human Environment Interactions: Tropical and Subtropical Region",
        questions: [
          q({
            text: "The Amazon Basin, lying between 10°N and 10°S, is referred to as the:",
            options: [
              "Sub-tropical region",
              "Equatorial region",
              "Temperate region",
              "Polar region",
            ],
            correct: 1,
            explanation:
              "Because the tropical Amazon region lies very close to the equator, between 10°N and 10°S, it is referred to as the equatorial region.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Amazon river flows from the mountains in the west and empties into which ocean in the east?",
            options: ["Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean"],
            correct: 1,
            explanation:
              "The Amazon River flows from the mountains in the west of South America and reaches the Atlantic Ocean in the east.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following countries is NOT drained by the Amazon river basin?",
            options: ["Brazil", "Peru", "Bolivia", "Australia"],
            correct: 3,
            explanation:
              "The Amazon Basin drains portions of Brazil, Peru, Bolivia, Ecuador, Colombia and a small part of Venezuela — Australia is not part of the basin.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Amazon Basin's climate is best described as:",
            options: [
              "Cold and dry throughout the year",
              "Hot and wet throughout the year",
              "Mild with four distinct seasons",
              "Extremely arid with almost no rainfall",
            ],
            correct: 1,
            explanation:
              "The Amazon Basin, straddling the equator, has a hot and wet climate throughout the year, with heavy rainfall almost every day.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In the Amazon rainforest, the dense canopy cover means that:",
            options: [
              "Sunlight easily reaches the forest floor",
              "The forest floor remains dark and damp, allowing only shade-tolerant plants to grow",
              "No plants grow at all",
              "Snow covers the ground for most of the year",
            ],
            correct: 1,
            explanation:
              "The thick 'roof' of leaves and branches does not allow sunlight to reach the ground, so it remains dark and damp, suitable only for shade-tolerant vegetation like orchids and bromeliads.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which large flesh-eating fish, found in the Amazon river, is mentioned in the chapter?",
            options: ["Hilsa", "Piranha", "Catla", "Rohu"],
            correct: 1,
            explanation:
              "The flesh-eating Piranha fish is found in the Amazon river, along with anacondas, boa constrictors and other reptiles.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The traditional method of cultivation practised by the people of the Amazon Basin, in which land is cleared by cutting and burning vegetation, is called:",
            options: [
              "Terrace farming",
              "Slash and burn agriculture",
              "Plantation farming",
              "Contour farming",
            ],
            correct: 1,
            explanation:
              "People of the Amazon Basin practise slash and burn agriculture, clearing small forest patches by cutting and burning trees before growing crops.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Manioc, also known as cassava, and grown under the ground like a potato, is the staple food of the people of the:",
            options: [
              "Ganga-Brahmaputra Basin",
              "Sahara desert",
              "Amazon Basin",
              "Prairies",
            ],
            correct: 2,
            explanation:
              "Manioc, or cassava, grown like a potato underground, is the staple food of the people of the Amazon Basin.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Large apartment-like houses with a steeply slanting roof, built by the people of the Amazon Basin, are called:",
            options: ["Gompas", "Igloos", "Maloca", "Yurts"],
            correct: 2,
            explanation:
              "Some Amazon Basin families live in large apartment-like houses called 'Maloca', which have a steeply slanting roof, while others live in thatched, beehive-shaped houses.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Trans-Amazon Highway, constructed in 1970, made which region accessible for the first time by road?",
            options: [
              "The Sahara desert",
              "The Ganga-Brahmaputra plain",
              "The interior of the Amazon rainforest",
              "Ladakh",
            ],
            correct: 2,
            explanation:
              "In 1970, the Trans-Amazon highway made all parts of the Amazon rainforest accessible, which earlier could be reached only by navigating the river.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Ganga-Brahmaputra Basin, lying between 10°N and 30°N latitudes, is located in which climatic region?",
            options: [
              "Equatorial region",
              "Sub-tropical region",
              "Polar region",
              "Mediterranean region",
            ],
            correct: 1,
            explanation:
              "The Ganga-Brahmaputra basin lies in the sub-tropical region, situated between 10°N and 30°N latitudes, and experiences a monsoon climate.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The main crop grown in the fertile plains of the Ganga-Brahmaputra Basin, requiring sufficient water, is:",
            options: ["Wheat", "Paddy (rice)", "Maize", "Millets"],
            correct: 1,
            explanation:
              "Paddy is the main crop of the basin's plains, grown where the amount of rainfall is high since it requires sufficient water.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which cash crops are commonly grown in the Ganga-Brahmaputra plains, apart from tea?",
            options: [
              "Coffee and rubber",
              "Sugarcane and jute",
              "Cotton and groundnut",
              "Cocoa and cashew",
            ],
            correct: 1,
            explanation:
              "Cash crops like sugarcane and jute are grown in the Ganga-Brahmaputra plains, along with banana plantations in some areas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tea plantations in the Ganga-Brahmaputra Basin are mainly found in which two regions?",
            options: [
              "Bihar and Uttar Pradesh",
              "West Bengal and Assam",
              "Punjab and Haryana",
              "Kerala and Karnataka",
            ],
            correct: 1,
            explanation:
              "Tea is grown in plantations in West Bengal and Assam, while silk is produced through sericulture in parts of Bihar and Assam.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The one-horned rhinoceros, a distinctive animal of this basin, is mainly found in the:",
            options: [
              "Sundarbans delta",
              "Brahmaputra plain",
              "Ganga plain near Varanasi",
              "Himalayan foothills",
            ],
            correct: 1,
            explanation:
              "The one-horned rhinoceros is found specifically in the Brahmaputra plain, while the Bengal tiger, crocodiles and alligators are found in the delta area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The presence of the 'Susu' or blind dolphin in the Ganga and Brahmaputra rivers is considered an indicator of:",
            options: [
              "High salinity",
              "The health of the river",
              "Heavy rainfall",
              "Tourism potential",
            ],
            correct: 1,
            explanation:
              "The presence of Susu (blind dolphin) indicates the health of the river; untreated industrial and urban waste with high chemical content is killing this species.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which city, located on the River Hooghly, is an important port serving the Ganga-Brahmaputra Basin?",
            options: ["Patna", "Varanasi", "Kolkata", "Kanpur"],
            correct: 2,
            explanation:
              "Kolkata is an important port on the River Hooghly, part of the well-developed transport network of the Ganga-Brahmaputra basin.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In parts of Uttarakhand, Sikkim and Arunachal Pradesh, where the climate is cool and slopes are steep, which type of vegetation is found?",
            options: [
              "Mangrove forests",
              "Coniferous trees like pine, deodar and fir",
              "Thorny scrub",
              "Tropical evergreen rainforest",
            ],
            correct: 1,
            explanation:
              "Coniferous trees like pine, deodar and fir grow in the cooler, steeper parts of Uttarakhand, Sikkim and Arunachal Pradesh, while mangroves cover the delta area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The famous wildlife sanctuaries of Kaziranga and Manas, mentioned as tourist attractions of the basin, are located in:",
            options: ["Bihar", "Assam", "Uttar Pradesh", "West Bengal"],
            correct: 1,
            explanation:
              "Kaziranga and Manas wildlife sanctuaries, home to species like the tiger, are located in Assam, within the Ganga-Brahmaputra basin.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which famous monument, located on the banks of the River Yamuna, is mentioned as a tourist attraction of the Ganga-Brahmaputra basin's cultural landscape?",
            options: ["Qutub Minar", "Taj Mahal", "Red Fort", "Gateway of India"],
            correct: 1,
            explanation:
              "The Taj Mahal, on the banks of the River Yamuna in Agra, is mentioned as one of the notable tourist attractions of the basin.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "life-in-temperate-grasslands",
        name: "Life in the Temperate Grasslands",
        questions: [
          q({
            text: "The temperate grasslands of North America, known for their tall-grass 'sea of grass' landscape, are called:",
            options: ["Velds", "Prairies", "Pampas", "Steppes"],
            correct: 1,
            explanation:
              "The temperate grasslands of North America are called the Prairies, a region of flat, gently sloping or hilly land, mostly treeless.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Prairies are bound by the Rocky Mountains in the west and which feature in the east?",
            options: [
              "The Appalachian Mountains",
              "The Great Lakes",
              "The Mississippi Delta",
              "The Atlantic Ocean",
            ],
            correct: 1,
            explanation:
              "The Prairies are bound by the Rocky Mountains in the west and the Great Lakes in the east.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The local hot wind that blows in winter in the Prairies, raising temperatures and melting snow to expose pasture land, is called:",
            options: ["Loo", "Chinook", "Mistral", "Sirocco"],
            correct: 1,
            explanation:
              "Chinook is a hot wind that blows in winter in the Prairies, raising the temperature and melting snow, making pasture land available for grazing.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The major crop grown in the Prairies, which has made North America a surplus food producer, is:",
            options: ["Rice", "Maize", "Cotton", "Sugarcane"],
            correct: 1,
            explanation:
              "Maize is the major crop of the Prairies, though other crops such as potatoes, soybean, cotton and alfalfa are also grown where rainfall exceeds 50 cm.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Prairies are often referred to as the 'Granaries of the World' due to their huge surplus production of:",
            options: ["Rice", "Wheat", "Maize", "Cotton"],
            correct: 1,
            explanation:
              "The Prairies are known as the 'Granaries of the world' due to the huge surplus of wheat production, made possible by scientific cultivation methods.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Large cattle farms in the Prairies, looked after by cowboys, are called:",
            options: ["Velds", "Ranches", "Kraals", "Steppes"],
            correct: 1,
            explanation:
              "Large cattle farms called ranches, looked after by sturdy men called cowboys, are found in the drier parts of the Prairies suitable for cattle rearing.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Bison, or American buffalo — the most important animal of the Prairies — nearly went extinct due to:",
            options: [
              "Disease outbreaks",
              "Indiscriminate hunting",
              "Deforestation alone",
              "Prolonged drought",
            ],
            correct: 1,
            explanation:
              "The Bison nearly became extinct due to indiscriminate hunting, and is now a protected species in the Prairies.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The dairy belt of North America extends from the Great Lakes to which coast?",
            options: ["Pacific Coast", "Gulf Coast", "Atlantic Coast", "Arctic Coast"],
            correct: 2,
            explanation:
              "The dairy belt extends from the Great Lakes to the Atlantic Coast in the east, supporting food-processing industries in the Prairies region.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The temperate grasslands of South Africa are known as:",
            options: ["Prairies", "Pampas", "Velds", "Downs"],
            correct: 2,
            explanation:
              "The temperate grasslands of South Africa are called the Velds, rolling plateaus with heights ranging from 600 m to 1,100 m.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Velds are bound by the Drakensberg Mountains to the east, and by which desert to the west?",
            options: [
              "Sahara Desert",
              "Kalahari Desert",
              "Gobi Desert",
              "Thar Desert",
            ],
            correct: 1,
            explanation:
              "The Velds are bound by the Drakensberg Mountains on the east, while the Kalahari desert lies to the west.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which rivers drain the Veld region of South Africa?",
            options: [
              "Nile and Congo",
              "Orange and Limpopo",
              "Zambezi and Niger",
              "Amazon and Parana",
            ],
            correct: 1,
            explanation:
              "The tributaries of the Orange and Limpopo rivers drain the Veld region of South Africa.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Velds, the rainy season occurs mainly from November to February, due to the influence of:",
            options: [
              "Cold Antarctic winds",
              "Warm ocean currents washing the shores of the velds",
              "The Chinook wind",
              "The monsoon system",
            ],
            correct: 1,
            explanation:
              "The velds receive rainfall mainly from November to February because of warm ocean currents that wash their shores; scanty winter rainfall (June-August) can lead to drought.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The most important occupation of the people of the Velds, giving rise to a major wool industry, is:",
            options: ["Fishing", "Sheep rearing", "Rice cultivation", "Coffee plantation"],
            correct: 1,
            explanation:
              "Sheep rearing is the most important occupation in the Velds, bred mainly for wool, which has given rise to the wool industry.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which breed of sheep, valued for its very warm wool, is popular in the Velds?",
            options: ["Merino", "Rambouillet", "Karakul", "Suffolk"],
            correct: 0,
            explanation:
              "Merino sheep, whose wool is very warm, is a popular breed reared in the Velds.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Johannesburg, located in the Veld region, is famously known as the:",
            options: [
              "Diamond capital of the world",
              "Gold capital of the world",
              "Wool capital of the world",
              "Wheat capital of the world",
            ],
            correct: 1,
            explanation:
              "Johannesburg is known as the gold capital of the world, while Kimberley is famous for its diamond mines.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Kimberley, in South Africa, is world-famous for its:",
            options: [
              "Gold mines",
              "Diamond mines",
              "Coal mines",
              "Iron ore mines",
            ],
            correct: 1,
            explanation:
              "Kimberley is famous for its diamond mines, and mining of diamond and gold led South Africa to establish trade ties with Britain, eventually becoming a British colony.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Lions, leopards, cheetah and kudu are the primary wild animals found in which grassland region?",
            options: ["Prairies", "Pampas", "Velds", "Downs"],
            correct: 2,
            explanation:
              "Lions, leopards, cheetah and kudu are the primary wild animals of the Veld region of South Africa.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "life-in-the-deserts",
        name: "Life in the Deserts",
        questions: [
          q({
            text: "The Sahel region, a semi-arid transitional zone experiencing desertification, is located to which side of the Sahara Desert?",
            options: ["South", "North", "East", "West"],
            correct: 0,
            explanation: "The Sahel is a semi-arid belt of land lying immediately to the south of the Sahara Desert, forming a transitional zone between the desert and the savanna grasslands.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Among various contributing factors, which of the following is a major cause of desertification in regions like the Sahel?",
            options: ["Rising temperature and prolonged drought", "Excessive rainfall", "Volcanic eruptions", "Glacial retreat"],
            correct: 0,
            explanation: "Rising temperatures, reduced and erratic rainfall, and prolonged drought — often compounded by overgrazing and deforestation — are major drivers of desertification in semi-arid regions such as the Sahel.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Sahara, the world's largest desert covering a large part of North Africa, has an area of approximately:",
            options: ["3.2 million sq km", "8.54 million sq km", "1 million sq km", "15 million sq km"],
            correct: 1,
            explanation:
              "The Sahara desert has an area of around 8.54 million sq km — considerably larger than India's total area of about 3.2 million sq km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Sahara desert touches how many countries?",
            options: ["5", "8", "11", "15"],
            correct: 2,
            explanation:
              "The Sahara touches eleven countries: Algeria, Chad, Egypt, Libya, Mali, Mauritania, Morocco, Niger, Sudan, Tunisia and Western Sahara.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Apart from vast stretches of sand, the Sahara desert also contains:",
            options: [
              "Dense tropical forests",
              "Gravel plains and elevated rocky plateaus",
              "Permanent ice sheets",
              "Large freshwater lakes",
            ],
            correct: 1,
            explanation:
              "Besides sand, the Sahara also has gravel plains and elevated plateaus with bare rocky surfaces, some more than 2,500 m high.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The highest temperature ever recorded in the Sahara desert, at Al Azizia in Libya in 1922, was:",
            options: ["40.5°C", "50°C", "57.7°C", "65°C"],
            correct: 2,
            explanation:
              "Al Azizia in the Sahara desert, south of Tripoli, Libya, recorded the highest temperature of 57.7°C in 1922.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Green islands with date palms, found in depressions of the Sahara desert where underground water reaches the surface, are called:",
            options: ["Wadis", "Oases", "Deltas", "Steppes"],
            correct: 1,
            explanation:
              "Oases are green islands with date palms formed where underground water reaches the surface in wind-formed depressions.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Bedouins and Tuaregs, nomadic tribes who rear livestock such as goats, sheep and camels, are found in which region?",
            options: ["Ladakh", "The Sahara desert", "The Amazon Basin", "The Prairies"],
            correct: 1,
            explanation:
              "The Bedouins and Tuaregs are nomadic tribes of the Sahara desert who rear livestock and use hides, hair and milk from their animals for daily needs.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Egyptian cotton, famous worldwide, is grown mainly along which river valley in the Sahara region?",
            options: ["Congo Valley", "Nile Valley", "Niger Valley", "Zambezi Valley"],
            correct: 1,
            explanation:
              "The Nile Valley in Egypt supports settled population growing date palms, rice, wheat, barley, beans, and the world-famous Egyptian cotton.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Ladakh, described as a cold desert, is located in the Great Himalayas on the eastern side of:",
            options: [
              "Himachal Pradesh",
              "Jammu and Kashmir",
              "Uttarakhand",
              "Sikkim",
            ],
            correct: 1,
            explanation:
              "Ladakh is a cold desert lying in the Great Himalayas, on the eastern side of Jammu and Kashmir.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Ladakh is enclosed by the Karakoram Range in the north and which mountains in the south?",
            options: [
              "Pir Panjal Range",
              "Zanskar Mountains",
              "Shivalik Range",
              "Aravalli Range",
            ],
            correct: 1,
            explanation:
              "Ladakh is enclosed by the Karakoram Range in the north and the Zanskar mountains in the south.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The most important river flowing through Ladakh is the:",
            options: ["Ganga", "Indus", "Brahmaputra", "Sutlej"],
            correct: 1,
            explanation:
              "Several rivers flow through Ladakh, with the Indus being the most important among them, forming deep valleys and gorges.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In Ladakh, winter night temperatures may fall as low as:",
            options: ["0°C", "-10°C", "Below -40°C", "10°C"],
            correct: 2,
            explanation:
              "Ladakh's winters are so harsh that temperatures may remain below -40°C for most of the time, while summer nights can fall well below -30°C.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Ladakh receives very little rainfall (as low as 10 cm a year) mainly because it lies in the:",
            options: [
              "Path of the monsoon winds",
              "Rain shadow of the Himalayas",
              "Equatorial low-pressure belt",
              "Coastal humid zone",
            ],
            correct: 1,
            explanation:
              "Ladakh lies in the rain shadow of the Himalayas, which is why it receives very little rainfall, as low as 10 cm every year.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Chiru, or Tibetan antelope, an endangered species found in Ladakh, is hunted illegally for its wool known as:",
            options: ["Merino wool", "Shahtoosh", "Angora", "Pashmina"],
            correct: 1,
            explanation:
              "The Chiru, or Tibetan antelope, is hunted for its wool known as shahtoosh, which is light in weight and extremely warm, making it an endangered species.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Famous Buddhist monasteries called 'gompas', such as Hemis, Thiksey, Shey and Lamayuru, are found in:",
            options: ["The Sahara desert", "Ladakh", "The Amazon Basin", "The Velds"],
            correct: 1,
            explanation:
              "Several Buddhist monasteries with traditional 'gompas', including Hemis, Thiksey, Shey and Lamayuru, dot the Ladakhi landscape.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Leh, the capital of Ladakh, is connected to the Kashmir Valley through which mountain pass via National Highway 1A?",
            options: ["Rohtang La", "Zoji La", "Baralacha La", "Khardung La"],
            correct: 1,
            explanation:
              "National Highway 1A connects Leh to the Kashmir Valley through the Zoji La pass.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the short summer season, people of Ladakh cultivate crops such as barley, peas, beans, turnip and:",
            options: ["Rice", "Potatoes", "Sugarcane", "Cotton"],
            correct: 1,
            explanation:
              "In summer, the people of Ladakh cultivate barley, potatoes, peas, beans and turnip, given the harsh, short growing season.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The two broad types of deserts found in the world, based on temperature, are hot deserts and:",
            options: ["Rocky deserts", "Cold deserts", "Sandy deserts", "Coastal deserts"],
            correct: 1,
            explanation:
              "Depending on temperature, deserts of the world are classified into hot deserts (like the Sahara) and cold deserts (like Ladakh).",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "resources",
        name: "Resources",
        questions: [
          q({
            text: "A resource is best defined as:",
            options: [
              "Anything found in nature",
              "Anything that can be used to satisfy a need",
              "Only economically valuable substances",
              "Only man-made objects",
            ],
            correct: 1,
            explanation:
              "As Amma explains in the chapter, anything that can be used to satisfy a need is a resource.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "What is it that gives an object or substance the status of a 'resource'?",
            options: ["Its size", "Its utility or usability", "Its colour", "Its location alone"],
            correct: 1,
            explanation:
              "Utility or usability is what makes an object or substance a resource — its use gives it value.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the chapter, resources are generally classified into natural, human made and:",
            options: ["Renewable", "Human", "Non-renewable", "Economic"],
            correct: 1,
            explanation:
              "Resources are generally classified into natural resources, human made resources and human resources.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Resources that are drawn from nature and used without much modification, such as air, water and minerals, are called:",
            options: ["Human made resources", "Natural resources", "Human resources", "Capital resources"],
            correct: 1,
            explanation:
              "Natural resources are drawn from nature and used without much modification; some need tools and technology to be used effectively.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Renewable resources are best described as:",
            options: [
              "Resources with a limited stock that take thousands of years to replenish",
              "Resources that get renewed or replenished quickly, such as solar and wind energy",
              "Only resources made by humans",
              "Resources found only underground",
            ],
            correct: 1,
            explanation:
              "Renewable resources get renewed or replenished quickly; some, like solar and wind energy, are unlimited, though careless use of others like water, soil and forests can still affect their stock.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Coal, petroleum and natural gas are examples of:",
            options: ["Renewable resources", "Non-renewable resources", "Human made resources", "Human resources"],
            correct: 1,
            explanation:
              "Non-renewable resources have a limited stock; once exhausted, it may take thousands of years to renew them. Coal, petroleum and natural gas are key examples.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Iron ore becomes a human made resource such as machinery, buildings or bridges only when:",
            options: [
              "It is left unused in the ground",
              "People extract and process it using technology",
              "It is declared a natural resource by law",
              "Its market price decreases",
            ],
            correct: 1,
            explanation:
              "Iron ore was not a resource until people learned to extract iron from it; human made resources are natural substances transformed using technology.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Improving the quality of people's skills so that they are able to create more resources is known as:",
            options: ["Sustainable development", "Human resource development", "Resource conservation", "Land reclamation"],
            correct: 1,
            explanation:
              "Education and health help make people a valuable resource; improving the quality of people's skills to create more resources is called human resource development.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Using resources carefully and giving them time to renew is called:",
            options: ["Resource conservation", "Resource depletion", "Land use", "Human resource development"],
            correct: 0,
            explanation:
              "Resource conservation means using resources carefully and giving them time to get renewed.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Balancing the need to use resources today while also conserving them for the future is called:",
            options: ["Resource mapping", "Sustainable development", "Land reclamation", "Afforestation"],
            correct: 1,
            explanation:
              "Sustainable development means carefully utilising resources so that, besides meeting present requirements, it also takes care of future generations.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following pairs of factors are described as important in changing substances into resources?",
            options: [
              "Money and labour only",
              "Time and technology",
              "Population and climate",
              "Soil and rainfall",
            ],
            correct: 1,
            explanation:
              "Time and technology are two important factors that can change substances into resources, related to the needs of the people.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The distribution of natural resources over the earth is unequal mainly because of differences in:",
            options: [
              "Government policy alone",
              "Physical factors like terrain, climate and altitude",
              "Population size alone",
              "Religion",
            ],
            correct: 1,
            explanation:
              "The distribution of natural resources depends on physical factors like terrain, climate and altitude, which differ across the earth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following does NOT, by itself, make a substance a resource, according to the chapter's exercise?",
            options: ["Utility", "Value", "Quantity", "Technology"],
            correct: 2,
            explanation:
              "The chapter's exercise identifies utility and value as what make a substance a resource — mere quantity does not.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following resources may have no direct economic (commercial) value, but is still important because it satisfies a human need?",
            options: ["Iron ore", "A beautiful landscape", "Petroleum", "Coal"],
            correct: 1,
            explanation:
              "The chapter notes that a beautiful landscape may not have economic value, but both economically valuable and non-economic resources are important and satisfy human needs.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The main principles of sustainable development include respecting and caring for all forms of life, improving the quality of human life, and:",
            options: [
              "Maximising the depletion of natural resources",
              "Minimising the depletion of natural resources and enabling communities to care for their own environment",
              "Ignoring community involvement in environmental care",
              "Focusing only on rapid economic growth",
            ],
            correct: 1,
            explanation:
              "The chapter lists principles of sustainable development, including minimising the depletion of natural resources, conserving the earth's vitality and diversity, and enabling communities to care for their own environment.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "land-soil-water-vegetation-wildlife-resources",
        name: "Land, Soil, Water, Natural Vegetation and Wildlife Resources",
        questions: [
          q({
            text: "Land covers only about what percentage of the total area of the earth's surface, and not all of this is habitable?",
            options: ["10%", "30%", "50%", "70%"],
            correct: 1,
            explanation:
              "Land covers only about thirty per cent of the total area of the earth's surface, and all parts of this small percentage are not habitable.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the chapter, ninety per cent of the world's population occupies only about what percentage of the total land area?",
            options: ["10%", "30%", "50%", "70%"],
            correct: 1,
            explanation:
              "Ninety per cent of the world population occupies only thirty per cent of the land area; the remaining seventy per cent is sparsely populated or uninhabited.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which areas are normally densely populated because they offer suitable land for agriculture?",
            options: [
              "Deserts and thick forested areas",
              "Plains and river valleys",
              "High mountain ranges",
              "Low-lying areas prone to water-logging",
            ],
            correct: 1,
            explanation:
              "Plains and river valleys offer suitable land for agriculture, making them the densely populated areas of the world.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The different purposes for which land is used — such as agriculture, forestry, mining, building houses and roads — is termed:",
            options: ["Land reclamation", "Land use", "Land degradation", "Land ownership"],
            correct: 1,
            explanation:
              "Land use refers to the way land is used for different purposes such as agriculture, forestry, mining, building houses, roads and industries.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Land owned by the community for common uses like collection of fodder, fruits, nuts or medicinal herbs is called:",
            options: ["Private land", "Common property resources", "Arable land", "Fallow land"],
            correct: 1,
            explanation:
              "Community land, owned by the community for common uses, is also called common property resources, as distinct from privately owned land.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT listed as a common method for conserving land resources?",
            options: [
              "Afforestation",
              "Land reclamation",
              "Overgrazing",
              "Regulated use of chemical fertilisers and pesticides",
            ],
            correct: 2,
            explanation:
              "Afforestation, land reclamation and regulated use of chemical fertilisers/pesticides help conserve land — overgrazing, by contrast, is a cause of land degradation, not a conservation method.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Soil is best defined as:",
            options: [
              "A rock formed by cooling magma",
              "The thin layer of grainy substance covering the earth's surface, made of organic matter, minerals and weathered rock",
              "Only decomposed plant material",
              "A type of mineral ore",
            ],
            correct: 1,
            explanation:
              "Soil is the thin layer of grainy substance covering the earth's surface, made up of organic matter, minerals and weathered rocks, formed through weathering.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The breaking up and decay of exposed rocks due to temperature changes, frost action, plants, animals and human activity is called:",
            options: ["Erosion", "Weathering", "Leaching", "Sedimentation"],
            correct: 1,
            explanation:
              "Weathering is the breaking up and decay of exposed rocks, which produces the minerals and weathered rock material that make up soil.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT one of the major factors of soil formation described in the chapter?",
            options: ["Nature of the parent rock", "Climate", "Human population density", "Relief and time"],
            correct: 2,
            explanation:
              "The major factors of soil formation are the parent rock, climate, relief (topography), flora/fauna/micro-organisms and time — human population density is not among them.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The mass movement of rock, debris or earth down a slope, often triggered by earthquakes, floods or intense rainfall, is called a:",
            options: ["Landslide", "Avalanche", "Sinkhole", "Delta"],
            correct: 0,
            explanation:
              "Landslides are the mass movement of rock, debris or earth down a slope, often taking place along with earthquakes, floods and volcanoes, as illustrated by the Kinnaur (Himachal Pradesh) case study.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which soil conservation method involves covering bare ground between plants with a layer of organic matter like straw to retain soil moisture?",
            options: ["Terrace farming", "Mulching", "Contour ploughing", "Shelter belts"],
            correct: 1,
            explanation:
              "Mulching covers the bare ground between plants with organic matter such as straw, helping retain soil moisture.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Ploughing parallel to the contours of a hill slope, forming a natural barrier that slows down the flow of water, is called:",
            options: ["Intercropping", "Mulching", "Contour ploughing", "Rock dam construction"],
            correct: 2,
            explanation:
              "Contour ploughing is ploughing parallel to the contours of a hill slope, forming a natural barrier for water flowing down the slope.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rows of trees planted in coastal and dry regions to check wind movement and protect the soil cover are called:",
            options: ["Shelter belts", "Contour barriers", "Rock dams", "Terraces"],
            correct: 0,
            explanation:
              "Shelter belts are rows of trees planted in coastal and dry regions to check wind movement and protect soil cover.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Broad, flat steps made on steep slopes to reduce surface run-off and soil erosion, allowing crops to be grown, are called:",
            options: ["Contour barriers", "Terrace farming", "Shelter belts", "Mulching"],
            correct: 1,
            explanation:
              "Terrace farming creates broad flat steps on steep slopes, reducing surface run-off and soil erosion so that crops can be grown.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Since three-fourths of the earth's surface is covered with water, the earth is appropriately called the:",
            options: ["Green planet", "Water planet", "Blue marble", "Living planet"],
            correct: 1,
            explanation:
              "Three-fourths of the earth's surface is covered with water, which is why it is appropriately called the 'water planet'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Of the earth's total water, fresh water accounts for only about 2.7 per cent, and of this, only about how much is actually accessible and fit for human use?",
            options: ["50%", "25%", "About 1%", "70%"],
            correct: 2,
            explanation:
              "Nearly 70% of fresh water occurs as inaccessible ice sheets and glaciers; only about 1% of fresh water is available and fit for human use, as ground water, surface water and atmospheric vapour.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Nearly seventy per cent of the earth's fresh water occurs as:",
            options: [
              "Groundwater",
              "Ice sheets and glaciers in regions like Antarctica and Greenland",
              "River water",
              "Atmospheric water vapour",
            ],
            correct: 1,
            explanation:
              "About 70 per cent of fresh water occurs as ice sheets and glaciers in Antarctica, Greenland and mountain regions, and due to their location, they are inaccessible.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The continuous circulation of water between the oceans, atmosphere and land through evaporation, precipitation and run-off is called:",
            options: ["The rock cycle", "The water cycle", "The nitrogen cycle", "The carbon cycle"],
            correct: 1,
            explanation:
              "Water's total volume remains constant on earth; its abundance only seems to vary because it constantly cycles through the water cycle.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the chapter's survey data on an average urban Indian's water use (150 litres/day), which of the following uses consume the largest, EQUAL shares (40 litres each)?",
            options: [
              "Drinking and cooking",
              "Flushing and washing clothes",
              "Bathing and gardening",
              "Washing utensils and drinking",
            ],
            correct: 1,
            explanation:
              "According to the chapter's table, flushing (40 litres) and washing clothes (40 litres) are the two largest, equal uses out of a total of 150 litres per person per day.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rainwater harvesting refers to:",
            options: [
              "Building large dams on rivers",
              "Collecting rainwater from rooftops and directing it to a location where it is stored for future use",
              "Drilling deep wells for groundwater",
              "Desalinating ocean water",
            ],
            correct: 1,
            explanation:
              "Rainwater harvesting is the process of collecting rainwater from roof tops and directing it to an appropriate location for storage and future use.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In dry regions with high rates of evaporation, which irrigation method is described as most effective in checking water losses through seepage and evaporation?",
            options: ["Flood irrigation", "Drip or trickle irrigation", "Canal irrigation", "Only sprinkler irrigation"],
            correct: 1,
            explanation:
              "In dry regions with high evaporation rates, drip or trickle irrigation is very useful in checking water losses through seepage and evaporation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The narrow zone of contact between the lithosphere, hydrosphere and atmosphere, where living beings are inter-related and interdependent, is called the:",
            options: ["Ecosystem", "Biosphere", "Troposphere", "Food web"],
            correct: 1,
            explanation:
              "Natural vegetation and wildlife exist only in the narrow zone of contact between lithosphere, hydrosphere and atmosphere, called the biosphere.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The major vegetation types of the world are grouped as forests, grasslands, tundra and:",
            options: ["Wetlands", "Scrubs", "Deserts", "Coral reefs"],
            correct: 1,
            explanation:
              "The chapter groups the major vegetation types of the world as forests, grasslands, scrubs and tundra.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Forests are typically associated with areas having:",
            options: [
              "Low and unreliable rainfall",
              "Abundant water supply",
              "No rainfall at all",
              "Only cold polar climates",
            ],
            correct: 1,
            explanation:
              "In areas of heavy rainfall, huge trees may thrive, so forests are associated with areas having abundant water supply.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Tundra vegetation, found in cold polar regions, mainly comprises:",
            options: ["Tall hardwood trees", "Mosses and lichens", "Thorny shrubs", "Dense grasslands"],
            correct: 1,
            explanation:
              "Tundra vegetation of cold polar regions comprises mosses and lichens.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following are described as protected areas made to conserve natural vegetation and wildlife?",
            options: [
              "Only agricultural cooperatives",
              "National parks, wildlife sanctuaries and biosphere reserves",
              "Only zoos",
              "Only botanical gardens",
            ],
            correct: 1,
            explanation:
              "National parks, wildlife sanctuaries and biosphere reserves are made to protect natural vegetation and wildlife.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "CITES, an international agreement aimed at ensuring that trade in wild animals and plants does not threaten their survival, stands for:",
            options: [
              "Convention on International Trade in Endangered Species of Wild Fauna and Flora",
              "Committee for International Tracking of Endangered Species",
              "Council for Indian Trade and Environmental Safety",
              "Convention on Industrial Trade and Ecological Sustainability",
            ],
            correct: 0,
            explanation:
              "CITES stands for the Convention on International Trade in Endangered Species of Wild Fauna and Flora, and protects roughly 5,000 species of animals and 28,000 species of plants.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT listed among the human/natural factors accelerating the extinction of vegetation and wildlife resources?",
            options: ["Deforestation", "Poaching", "Afforestation", "Forest fires"],
            correct: 2,
            explanation:
              "Deforestation, soil erosion, constructional activities, forest fires, tsunami, landslides and poaching accelerate extinction — afforestation is a conservation measure, not a threat.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Vultures in the Indian subcontinent were found to be dying of kidney failure after scavenging on livestock treated with:",
            options: [
              "Antibiotics",
              "Diclofenac, a painkiller",
              "Pesticides sprayed on crops",
              "Industrial effluents",
            ],
            correct: 1,
            explanation:
              "Vultures were dying of kidney failure after scavenging on livestock treated with diclofenac, a painkiller similar to aspirin or ibuprofen; efforts are on to ban the drug for livestock use.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "mineral-and-power-resources",
        name: "Mineral and Power Resources",
        questions: [
          q({
            text: "Among India's major mica-producing states are:",
            options: ["Rajasthan, Gujarat and Andhra Pradesh", "Kerala, Tamil Nadu and Goa", "Punjab, Haryana and Delhi", "Assam, Nagaland and Manipur"],
            correct: 0,
            explanation: "India's leading mica-producing states include Rajasthan (the largest producer), Andhra Pradesh and Gujarat, which together account for the bulk of the country's mica output.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "A mineral is defined as:",
            options: [
              "A naturally occurring substance with a definite chemical composition",
              "Any rock found on the earth's surface",
              "Only metals used in industry",
              "A fossil fuel only",
            ],
            correct: 0,
            explanation:
              "A naturally occurring substance that has a definite chemical composition is a mineral; minerals are identified by physical properties like colour, density and hardness.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Rocks from which minerals are mined are known as:",
            options: ["Ores", "Alloys", "Sediments", "Aggregates"],
            correct: 0,
            explanation:
              "Rocks from which minerals are mined are known as ores; although over 2,800 types of minerals are identified, only about 100 are considered ore minerals.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "On the basis of composition, minerals are broadly classified as metallic and:",
            options: ["Ferrous", "Non-metallic", "Radioactive", "Fossil"],
            correct: 1,
            explanation:
              "Minerals are classified mainly as metallic and non-metallic minerals; metallic minerals are further divided into ferrous and non-ferrous.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Ferrous minerals, such as iron ore, manganese and chromites, are metallic minerals that contain:",
            options: ["Gold", "Iron", "Copper", "Silver"],
            correct: 1,
            explanation:
              "Ferrous minerals like iron ore, manganese and chromites contain iron, while non-ferrous minerals contain other metals such as gold, silver, copper or lead.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Limestone, mica and gypsum are examples of:",
            options: ["Metallic minerals", "Non-metallic minerals", "Fossil fuels only", "Ferrous minerals"],
            correct: 1,
            explanation:
              "Non-metallic minerals do not contain metals; limestone, mica and gypsum are examples, along with mineral fuels like coal and petroleum.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The process of taking out minerals that lie at shallow depths by removing the surface layer is called:",
            options: ["Shaft mining", "Open-cast mining", "Drilling", "Quarrying"],
            correct: 1,
            explanation:
              "Open-cast mining is used to extract minerals lying at shallow depths, by removing the surface layer.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Deep bores made to reach mineral deposits lying at great depths are called:",
            options: ["Open-cast mining", "Shaft mining", "Quarrying", "Drilling"],
            correct: 1,
            explanation:
              "Shaft mining involves making deep bores, called shafts, to reach mineral deposits that lie at great depths.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Petroleum and natural gas, which occur far below the earth's surface, are extracted through deep wells in a process called:",
            options: ["Mining", "Quarrying", "Drilling", "Smelting"],
            correct: 2,
            explanation:
              "Deep wells are bored to take out petroleum and natural gas, which occur far below the earth's surface — this process is called drilling.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Minerals that lie near the surface and are simply dug out are extracted by the process known as:",
            options: ["Drilling", "Quarrying", "Shaft mining", "Smelting"],
            correct: 1,
            explanation:
              "Quarrying is the process by which minerals lying near the surface are simply dug out.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Metallic minerals are generally found in which type of rock formations that form large plateaus?",
            options: [
              "Sedimentary rocks",
              "Igneous and metamorphic rocks",
              "Only coal seams",
              "Alluvial deposits",
            ],
            correct: 1,
            explanation:
              "Metallic minerals are generally found in igneous and metamorphic rock formations that form large plateaus, such as iron ore in Sweden and copper/nickel in Ontario, Canada.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Non-metallic minerals like limestone are generally found in:",
            options: [
              "Igneous rock formations",
              "Sedimentary rock formations of plains and young fold mountains",
              "Metamorphic rock formations only",
              "Volcanic ash deposits",
            ],
            correct: 1,
            explanation:
              "Sedimentary rock formations of plains and young fold mountains contain non-metallic minerals like limestone, along with mineral fuels such as coal and petroleum.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which country is described as the world's largest producer of high-grade iron ore, in South America?",
            options: ["Chile", "Peru", "Brazil", "Argentina"],
            correct: 2,
            explanation:
              "Brazil is the largest producer of high-grade iron ore in the world; Chile and Peru lead in copper production.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which continent is described as the world's largest producer of diamonds, gold and platinum?",
            options: ["Asia", "Africa", "South America", "Australia"],
            correct: 1,
            explanation:
              "Africa is rich in mineral resources and is the world's largest producer of diamonds, gold and platinum.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Australia is the world's largest producer of which mineral?",
            options: ["Gold", "Bauxite", "Tin", "Diamond"],
            correct: 1,
            explanation:
              "Australia is the largest producer of bauxite in the world, and is also a leading producer of gold, diamond, iron ore, tin and nickel.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Canadian Shield region of North America is a source of iron ore, nickel, gold, uranium and:",
            options: ["Bauxite", "Copper", "Petroleum", "Coal"],
            correct: 1,
            explanation:
              "Iron ore, nickel, gold, uranium and copper are mined in the Canadian Shield region north of the Great Lakes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Coal is often referred to as 'Buried Sunshine' because:",
            options: [
              "It is mined only in sunny regions",
              "It was formed millions of years ago from giant ferns and swamps buried under layers of earth",
              "It glows like sunshine when burnt",
              "It is used only for solar power generation",
            ],
            correct: 1,
            explanation:
              "Coal formed millions of years ago when giant ferns and swamps got buried under layers of earth, which is why it is referred to as 'Buried Sunshine'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following are the leading coal-producing areas of India mentioned in the chapter?",
            options: [
              "Digboi and Bombay High",
              "Raniganj, Jharia, Dhanbad and Bokaro",
              "Jaisalmer and Tripura",
              "Kalpakkam and Tarapur",
            ],
            correct: 1,
            explanation:
              "Raniganj, Jharia, Dhanbad and Bokaro in Jharkhand are the coal-producing areas of India mentioned in the chapter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The word 'Petroleum' is derived from Latin words meaning:",
            options: ["Black gold", "Rock oil", "Buried sunshine", "Liquid fire"],
            correct: 1,
            explanation:
              "Petroleum is derived from the Latin words Petra (rock) and oleum (oil), so petroleum literally means 'rock oil'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Petroleum and its derivatives are often called 'Black Gold' mainly because:",
            options: [
              "They are black in colour and extremely valuable",
              "They are mined alongside real gold deposits",
              "They turn into gold when refined",
              "They are found only in gold mines",
            ],
            correct: 0,
            explanation:
              "Petroleum and its derivatives are called 'Black Gold' as they are dark, thick liquids that are very valuable.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following are the leading petroleum-producing centres of India mentioned in the chapter?",
            options: [
              "Raniganj, Jharia and Bokaro",
              "Digboi in Assam, Bombay High and the deltas of Krishna and Godavari",
              "Kalpakkam and Narora",
              "Manikaran and Puga Valley",
            ],
            correct: 1,
            explanation:
              "The leading petroleum producers in India are Digboi in Assam, Bombay High in Mumbai, and the deltas of the Krishna and Godavari rivers.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which country was the first in the world to develop hydroelectricity?",
            options: ["France", "USA", "Norway", "China"],
            correct: 2,
            explanation:
              "Norway was the first country in the world to develop hydroelectricity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is an important hydel power station in India mentioned in the chapter?",
            options: ["Kalpakkam", "Bhakra Nangal", "Digboi", "Jaisalmer"],
            correct: 1,
            explanation:
              "Bhakra Nangal, Gandhi Sagar, Nagarjunsagar and Damodar Valley projects are important hydel power stations in India mentioned in the chapter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In India, uranium deposits are found in large quantities in Rajasthan and Jharkhand, while thorium is found in the monazite sands of:",
            options: ["Gujarat", "Kerala", "Odisha", "Tamil Nadu"],
            correct: 1,
            explanation:
              "Thorium is found in large quantities in the monazite sands of Kerala.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is a nuclear power station located in India, as mentioned in the chapter?",
            options: ["Kalpakkam in Tamil Nadu", "Bhakra Nangal in Punjab", "Jaisalmer in Rajasthan", "Raniganj in West Bengal"],
            correct: 0,
            explanation:
              "Nuclear power stations in India mentioned in the chapter include Kalpakkam in Tamil Nadu, Tarapur in Maharashtra, Rana Pratap Sagar in Rajasthan, Narora in Uttar Pradesh and Kaiga in Karnataka.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Heat energy obtained from the interior of the earth, which may sometimes surface as hot springs, is called:",
            options: ["Tidal energy", "Geothermal energy", "Biogas", "Nuclear energy"],
            correct: 1,
            explanation:
              "Geothermal energy is heat energy obtained from the earth's interior, sometimes surfacing as hot springs, and can be used to generate power.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In India, geothermal energy plants are located in Manikaran in Himachal Pradesh and in:",
            options: ["Puga Valley in Ladakh", "Kalpakkam in Tamil Nadu", "Jaisalmer in Rajasthan", "Digboi in Assam"],
            correct: 0,
            explanation:
              "In India, geothermal plants are located in Manikaran in Himachal Pradesh and Puga Valley in Ladakh.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Biogas, an excellent fuel for cooking and lighting made by decomposing organic waste, is essentially a mixture of methane and:",
            options: ["Nitrogen", "Carbon dioxide", "Oxygen", "Hydrogen"],
            correct: 1,
            explanation:
              "Biogas, produced by bacteria decomposing organic waste in biogas digesters, is essentially a mixture of methane and carbon dioxide.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Energy generated from the rise and fall of ocean tides, harnessed by building dams at narrow openings of the sea, is called:",
            options: ["Hydel power", "Tidal energy", "Geothermal energy", "Wind energy"],
            correct: 1,
            explanation:
              "Tidal energy is harnessed by building dams at narrow openings of the sea; the energy of the tides turns a turbine installed in the dam to produce electricity.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In India, a significant tidal energy site mentioned in the chapter, along with Russia and France, is the:",
            options: ["Bay of Bengal", "Gulf of Kachchh", "Arabian Sea near Mumbai", "Andaman Sea"],
            correct: 1,
            explanation:
              "Russia, France and the Gulf of Kachchh in India have huge tidal mill farms, according to the chapter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Power resources may be broadly categorised as conventional sources (like firewood and fossil fuels) and:",
            options: ["Metallic sources", "Non-conventional sources (like solar, wind and tidal energy)", "Sedimentary sources", "Organic sources"],
            correct: 1,
            explanation:
              "Power resources are broadly categorised as conventional sources (firewood and fossil fuels) and non-conventional sources (solar, wind, tidal, geothermal and nuclear energy, and biogas).",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "agriculture",
        name: "Agriculture",
        questions: [
          q({
            text: "The word 'Agriculture' is derived from the Latin words 'ager/agri' (meaning soil) and 'culture', meaning:",
            options: ["Trade", "Cultivation", "Harvest", "Irrigation"],
            correct: 1,
            explanation:
              "Agriculture is derived from Latin words ager or agri, meaning soil, and culture, meaning cultivation.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Economic activities connected with the extraction and production of natural resources, such as agriculture and fishing, are called:",
            options: ["Secondary activities", "Tertiary activities", "Primary activities", "Quaternary activities"],
            correct: 2,
            explanation:
              "Primary activities include all those connected with extraction and production of natural resources — agriculture, fishing and gathering are good examples.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Manufacturing of steel and baking of bread, which involve processing natural resources, are examples of:",
            options: ["Primary activities", "Secondary activities", "Tertiary activities", "None of these"],
            correct: 1,
            explanation:
              "Secondary activities are concerned with the processing of resources — manufacturing steel, baking bread and weaving cloth are examples.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Transport, trade, banking, insurance and advertising, which provide support to primary and secondary sectors, are examples of:",
            options: ["Primary activities", "Secondary activities", "Tertiary activities", "Quaternary activities"],
            correct: 2,
            explanation:
              "Tertiary activities provide support to primary and secondary sectors through services like transport, trade, banking, insurance and advertising.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The land on which crops are grown is known as:",
            options: ["Fallow land", "Arable land", "Wasteland", "Common land"],
            correct: 1,
            explanation:
              "Arable land is the land on which crops are grown; agricultural activity is concentrated in regions with suitable factors for crop growth.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The commercial rearing of silk worms is known as:",
            options: ["Pisciculture", "Viticulture", "Sericulture", "Horticulture"],
            correct: 2,
            explanation:
              "Sericulture is the commercial rearing of silk worms, which may supplement a farmer's income.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The breeding of fish in specially constructed tanks and ponds is called:",
            options: ["Sericulture", "Pisciculture", "Viticulture", "Horticulture"],
            correct: 1,
            explanation:
              "Pisciculture is the breeding of fish in specially constructed tanks and ponds.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The cultivation of grapes is known as:",
            options: ["Horticulture", "Viticulture", "Sericulture", "Pisciculture"],
            correct: 1,
            explanation:
              "Viticulture refers specifically to the cultivation of grapes.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Farming practised mainly to meet the needs of the farmer's family, using low levels of technology and household labour, is called:",
            options: ["Commercial farming", "Subsistence farming", "Plantation farming", "Mixed farming"],
            correct: 1,
            explanation:
              "Subsistence farming is practised to meet the needs of the farmer's family, traditionally with low technology and household labour producing small output.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Intensive subsistence agriculture, which allows more than one crop to be grown annually on a small plot, is prevalent mainly in:",
            options: [
              "Temperate grasslands of North America",
              "The thickly populated monsoon regions of south, southeast and east Asia",
              "The Sahara and Central Asia",
              "Western Europe",
            ],
            correct: 1,
            explanation:
              "Intensive subsistence agriculture, where rice is the main crop, is prevalent in the thickly populated areas of the monsoon regions of south, southeast and east Asia.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Shifting cultivation, in which a plot of forest land is cleared by felling and burning trees, is also known as:",
            options: ["Nomadic herding", "Slash and burn agriculture", "Plantation farming", "Mixed farming"],
            correct: 1,
            explanation:
              "Shifting cultivation, also known as 'slash and burn' agriculture, is practised in thickly forested areas like the Amazon basin, tropical Africa, southeast Asia and Northeast India.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Shifting cultivation is known as 'Jhumming' in North-East India, 'Milpa' in Mexico, 'Roca' in Brazil, and by which name in Malaysia?",
            options: ["Ladang", "Chena", "Conuco", "Coamil"],
            correct: 0,
            explanation:
              "Shifting cultivation is called 'Ladang' in Malaysia, as listed in the chapter's regional names for the practice.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Nomadic herding, practised in semi-arid and arid regions like the Sahara, Central Asia, Rajasthan and Jammu & Kashmir, primarily involves rearing:",
            options: ["Cattle and pigs", "Sheep, camel, yak and goats", "Poultry", "Only horses"],
            correct: 1,
            explanation:
              "In nomadic herding, herdsmen move with their animals — commonly sheep, camel, yak and goats — for fodder and water along defined routes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In commercial grain farming, practised in the sparsely populated temperate grasslands of North America, Europe and Asia, the main crops grown are:",
            options: ["Rice and jute", "Wheat and maize", "Tea and coffee", "Cotton and sugarcane"],
            correct: 1,
            explanation:
              "Commercial grain farming, practised over large farms in temperate grasslands, mainly grows wheat and maize for commercial purposes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mixed farming, in which land is used for growing food/fodder crops and rearing livestock, is practised in Europe, eastern USA, Argentina, southeast Australia, New Zealand and:",
            options: ["Brazil", "South Africa", "India", "China"],
            correct: 1,
            explanation:
              "Mixed farming is practised in Europe, eastern USA, Argentina, southeast Australia, New Zealand and South Africa.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Plantation agriculture, which grows a single crop like tea, coffee, sugarcane or rubber, requires large amounts of labour and capital, and is found mainly in:",
            options: ["Polar regions", "Tropical regions of the world", "Temperate grasslands", "Desert regions"],
            correct: 1,
            explanation:
              "Major plantations, growing crops like rubber (Malaysia), coffee (Brazil) and tea (India, Sri Lanka), are found in the tropical regions of the world.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Rice, the staple diet of tropical and sub-tropical regions, grows best in:",
            options: ["Black soil", "Alluvial clayey soil that can retain water", "Desert sandy soil", "Laterite soil"],
            correct: 1,
            explanation:
              "Rice needs high temperature, high humidity and rainfall, and grows best in alluvial clayey soil that can retain water.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "China leads the world in rice production, followed by:",
            options: ["India", "USA", "Brazil", "Australia"],
            correct: 0,
            explanation:
              "China leads in rice production, followed by India, Japan, Sri Lanka and Egypt.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Millets, also known as coarse grains, are a hardy crop that can be grown on:",
            options: [
              "Only the most fertile alluvial soils",
              "Less fertile and sandy soils",
              "Only black cotton soil",
              "Waterlogged soil",
            ],
            correct: 1,
            explanation:
              "Millets are hardy crops that can be grown on less fertile and sandy soils, needing low rainfall and moderate temperature.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Cotton, one of the main raw materials for the textile industry, grows best on black and alluvial soils and requires about how many frost-free days?",
            options: ["100", "150", "210", "300"],
            correct: 2,
            explanation:
              "Cotton requires high temperature, light rainfall, about 210 frost-free days and bright sunshine for its growth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Jute, known as the 'Golden Fibre', requiring high temperature and heavy rainfall, is mainly produced by India and:",
            options: ["Bangladesh", "Pakistan", "Egypt", "Sri Lanka"],
            correct: 0,
            explanation:
              "India and Bangladesh are the leading producers of jute, also known as the 'Golden Fibre'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Coffee, which requires a warm and wet climate and well-drained loamy soil on hill slopes, is led in production by:",
            options: ["India", "Colombia", "Brazil", "Kenya"],
            correct: 2,
            explanation:
              "Brazil is the leading producer of coffee, followed by Colombia and India.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Tea, a beverage crop requiring cool climate and well-distributed rainfall throughout the year, is best produced by which countries mentioned in the chapter?",
            options: [
              "Brazil, Colombia and India",
              "Kenya, India, China and Sri Lanka",
              "USA, Canada and Russia",
              "Egypt, Sudan and Nigeria",
            ],
            correct: 1,
            explanation:
              "Kenya, India, China and Sri Lanka produce the best quality tea in the world, as noted in the chapter.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In the chapter's case study, Munna Lal, a small farmer with about 1.5 hectares of land in Adilabad, Ghazipur district (Uttar Pradesh), typically grows two crops a year — normally wheat or rice, and:",
            options: ["Cotton", "Pulses", "Sugarcane", "Coffee"],
            correct: 1,
            explanation:
              "Munna Lal grows at least two crops a year, normally wheat or rice, and pulses, on his fertile 1.5-hectare farm.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the chapter's case study of a farm in the USA, Joe Horan, a farmer in Iowa State, owns about how much land, considerably larger than a typical Indian farm?",
            options: ["1.5 hectares", "30 hectares", "300 hectares", "3,000 hectares"],
            correct: 2,
            explanation:
              "Joe Horan, a farmer in the Midwest USA (Iowa State), owns about 300 hectares of land — much larger than the average Indian farm of about 1.5-2 hectares.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "industries",
        name: "Industries",
        questions: [
          q({
            text: "The Lancashire region of England became world-famous during the Industrial Revolution as a centre of which industry?",
            options: ["Cotton textiles", "Iron and steel", "Shipbuilding", "Coal mining alone"],
            correct: 0,
            explanation: "Lancashire, with its humid climate favourable to spinning and access to imported raw cotton via Liverpool, became the world's leading centre of cotton textile manufacturing during the Industrial Revolution.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Secondary activities, such as manufacturing, are best described as:",
            options: [
              "Extraction of raw natural resources",
              "Activities that change raw materials into products of more value to people",
              "Only banking and insurance services",
              "Transport of finished goods",
            ],
            correct: 1,
            explanation:
              "Secondary activities or manufacturing change raw materials into products of more value to people, as with pulp being changed into paper.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Industries that use plant and animal products as raw material, such as food processing, cotton textile and dairy, are called:",
            options: ["Mineral based industries", "Agro based industries", "Marine based industries", "Forest based industries"],
            correct: 1,
            explanation:
              "Agro based industries use plant and animal based products as their raw materials — food processing, vegetable oil, cotton textile, dairy and leather are examples.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Industries that use mineral ores as their raw material, whose products feed other industries, are called:",
            options: ["Agro based industries", "Mineral based industries", "Marine based industries", "Forest based industries"],
            correct: 1,
            explanation:
              "Mineral based industries are primary industries that use mineral ores as raw materials, such as iron made from iron ore.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Marine based industries, using products from the sea and oceans, include examples such as:",
            options: [
              "Furniture manufacturing",
              "Processing sea food or manufacturing fish oil",
              "Pulp and paper production",
              "Dairy product manufacturing",
            ],
            correct: 1,
            explanation:
              "Marine based industries use products from the sea and oceans as raw materials, such as processing sea food or manufacturing fish oil.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Cottage or household industries, where products are hand-made by artisans (like basket weaving and pottery), are a type of:",
            options: ["Large scale industry", "Small scale industry", "Public sector industry", "Joint sector industry"],
            correct: 1,
            explanation:
              "Cottage industries are a type of small scale industry where products are manufactured by hand by artisans, using less capital and technology than large scale industries.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Public sector industries, owned and operated by the government, include examples such as:",
            options: [
              "Maruti Udyog Limited",
              "Hindustan Aeronautics Limited and Steel Authority of India Limited",
              "Amul Dairy",
              "Tata Steel",
            ],
            correct: 1,
            explanation:
              "Public sector industries are owned and operated by the government, such as Hindustan Aeronautics Limited and Steel Authority of India Limited.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Maruti Udyog Limited, owned and operated jointly by the state and a group of individuals, is an example of:",
            options: ["Private sector industry", "Public sector industry", "Joint sector industry", "Cooperative sector industry"],
            correct: 2,
            explanation:
              "Maruti Udyog Limited is given as an example of a joint sector industry, owned and operated by the state and individuals together.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Industries owned and operated by producers or suppliers of raw materials, such as Amul and Sudha Dairy, are examples of:",
            options: ["Private sector industry", "Public sector industry", "Joint sector industry", "Cooperative sector industry"],
            correct: 3,
            explanation:
              "Co-operative sector industries are owned and operated by the producers or suppliers of raw materials, workers or both — Anand Milk Union Limited (Amul) and Sudha Dairy are success stories of this model.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT listed as one of the major factors affecting the location of industries?",
            options: ["Availability of raw material", "Labour and power", "Transport and market", "The political party in power"],
            correct: 3,
            explanation:
              "The factors affecting the location of industries are raw material, land, water, labour, power, capital, transport and market — not the ruling political party.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Major industrial regions of the world tend to be located in temperate areas, near sea ports and especially near:",
            options: ["Deserts", "Coal fields", "Mountain peaks", "Polar ice caps"],
            correct: 1,
            explanation:
              "Major industrial regions of the world, such as eastern North America and western Europe, tend to be located in temperate areas near sea ports and coal fields.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Bhopal gas tragedy of 3 December 1984, one of the worst industrial disasters in history, involved the leakage of which poisonous gas?",
            options: ["Chlorine gas", "Methyl Isocyanate (MIC)", "Carbon monoxide", "Sulphur dioxide"],
            correct: 1,
            explanation:
              "The Bhopal disaster was a technological accident in which highly poisonous Methyl Isocyanate (MIC) gas, along with Hydrogen Cyanide, leaked from a pesticide factory.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Bhopal gas tragedy occurred at a pesticide factory belonging to which company?",
            options: ["Tata Iron and Steel Company", "Union Carbide", "Steel Authority of India", "Reliance Industries"],
            correct: 1,
            explanation:
              "The Bhopal gas leak occurred at the pesticide factory of Union Carbide, with an official death toll of 3,598 by 1989.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Approximately how much coal, iron ore and limestone are combined to produce 1 tonne of steel, as illustrated in the chapter?",
            options: [
              "8 tonnes coal, 4 tonnes iron ore, 1 tonne limestone",
              "1 tonne coal, 8 tonnes iron ore, 4 tonnes limestone",
              "4 tonnes coal, 1 tonne iron ore, 8 tonnes limestone",
              "1 tonne coal, 1 tonne iron ore, 1 tonne limestone",
            ],
            correct: 0,
            explanation:
              "The chapter illustrates that 8 tonnes of coal, 4 tonnes of iron ore and 1 tonne of limestone together produce 1 tonne of steel.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The process in which metals are extracted from their ores by heating beyond the melting point is called:",
            options: ["Quarrying", "Smelting", "Drilling", "Weathering"],
            correct: 1,
            explanation:
              "Smelting is the process in which metals are extracted from their ores by heating them beyond the melting point, used in converting iron ore into steel in a blast furnace.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Before 1800 AD, the iron and steel industry was located mainly close to raw materials, power supply and:",
            options: ["Sea ports", "Running water", "Railway junctions", "Urban markets"],
            correct: 1,
            explanation:
              "Before 1800 AD, the iron and steel industry was located where raw materials, power supply and running water were easily available.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After 1950, the iron and steel industry began to be located on large areas of flat land near sea ports mainly because:",
            options: [
              "Coal had become scarce everywhere",
              "Iron ore had to be imported from overseas and steel works had become very large",
              "Labour was cheaper near ports",
              "Governments banned inland steel plants",
            ],
            correct: 1,
            explanation:
              "After 1950, steel works became very large and iron ore had to be imported from overseas, so the industry shifted to large flat areas near sea ports.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "TISCO (Tata Iron and Steel Company), India's first iron and steel plant, was started in 1907 at Sakchi, which was later renamed:",
            options: ["Bhilai", "Jamshedpur", "Rourkela", "Durgapur"],
            correct: 1,
            explanation:
              "TISCO was started in 1907 at Sakchi near the confluence of the Subarnarekha and Kharkai rivers in Jharkhand; Sakchi was later renamed Jamshedpur.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Jamshedpur, geographically the most conveniently situated iron and steel centre in India, is located near the confluence of which two rivers?",
            options: ["Ganga and Yamuna", "Subarnarekha and Kharkai", "Krishna and Godavari", "Narmada and Tapi"],
            correct: 1,
            explanation:
              "Jamshedpur (formerly Sakchi) is located near the confluence of the rivers Subarnarekha and Kharkai, which also ensured sufficient water supply for TISCO.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT one of India's major iron and steel producing centres mentioned in the chapter?",
            options: ["Bhilai", "Rourkela", "Jamnagar", "Durgapur"],
            correct: 2,
            explanation:
              "Bhilai, Durgapur, Burnpur, Jamshedpur, Rourkela and Bokaro are India's major steel centres — Jamnagar is not mentioned as a steel centre in the chapter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Pittsburgh, an important steel city of the USA, gets its iron ore from mines in Minnesota, transported cheaply via the famous:",
            options: ["Mississippi River", "Great Lakes waterway", "Panama Canal", "Erie Canal alone"],
            correct: 1,
            explanation:
              "Iron ore is shipped from mines in Minnesota to Pittsburgh via the Great Lakes waterway, one of the world's best routes for shipping ore cheaply.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Fibres used as raw material in the textile industry can be natural (wool, silk, cotton, jute) or man-made, such as:",
            options: ["Linen and cotton", "Nylon, polyester, acrylic and rayon", "Wool and silk", "Jute and flax"],
            correct: 1,
            explanation:
              "Man-made fibres used in the textile industry include nylon, polyester, acrylic and rayon, as distinct from natural fibres like wool, silk, cotton, linen and jute.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The first successful mechanized cotton textile mill in India was established in 1854 in:",
            options: ["Ahmedabad", "Mumbai", "Kolkata", "Surat"],
            correct: 1,
            explanation:
              "The first successful mechanized textile mill was established in Mumbai in 1854, aided by its port, climate and availability of raw material and skilled labour.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Ahmedabad, often called the 'Manchester of India', developed its cotton textile industry on the banks of which river?",
            options: ["Narmada", "Tapi", "Sabarmati", "Mahi"],
            correct: 2,
            explanation:
              "Ahmedabad, on the banks of the Sabarmati river, became the second largest textile city of India after Mumbai and was called the 'Manchester of India'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Osaka in Japan, known as the 'Manchester of Japan', developed its textile industry aided by which river?",
            options: ["Yodo", "Tone", "Shinano", "Kiso"],
            correct: 0,
            explanation:
              "The river Yodo provides sufficient water for the textile mills of Osaka, Japan's 'Manchester of Japan'.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Osaka's textile industry depends completely on imported raw cotton from countries including Egypt, India, China and:",
            options: ["Brazil", "USA", "Australia", "Argentina"],
            correct: 1,
            explanation:
              "Osaka imports raw cotton from Egypt, India, China and the USA, since the textile industry there depends entirely on imported raw materials.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The famous historical hand-woven cotton fabric, the Muslins, celebrated for their quality worldwide, was traditionally associated with which city?",
            options: ["Surat", "Dhaka", "Burhanpur", "Vadodara"],
            correct: 1,
            explanation:
              "The Muslins of Dhaka, along with the Chintzes of Masulipatnam and Calicos of Calicut, were known worldwide for their quality and design before the British era.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "human-resources",
        name: "Human Resources",
        questions: [
          q({
            text: "The way in which people are spread across the earth's surface is known as the pattern of:",
            options: ["Population density", "Population distribution", "Population composition", "Population pyramid"],
            correct: 1,
            explanation:
              "Population distribution refers to the way in which people are spread across the earth's surface.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the chapter, more than ninety per cent of the world's population lives on about what percentage of the land surface?",
            options: ["10%", "30%", "50%", "70%"],
            correct: 1,
            explanation:
              "More than ninety per cent of the world's population lives on about thirty per cent of the land surface, showing extremely uneven distribution.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following are described as densely populated / crowded regions of the world?",
            options: [
              "High mountains and tropical deserts",
              "South and southeast Asia, Europe and north eastern North America",
              "Equatorial forests and polar regions",
              "Antarctica and the Sahara",
            ],
            correct: 1,
            explanation:
              "South and south east Asia, Europe and north eastern North America are described as crowded areas, while high latitude regions, deserts, high mountains and equatorial forests have very few people.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Almost three-quarters of the world's population lives in which two continents?",
            options: ["Europe and North America", "Asia and Africa", "South America and Australia", "Africa and Europe"],
            correct: 1,
            explanation:
              "Almost three-quarters of the world's people live in the two continents of Asia and Africa.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Sixty per cent of the world's population lives in just how many countries, each having a population of more than 100 million?",
            options: ["5", "10", "15", "20"],
            correct: 1,
            explanation:
              "Sixty per cent of the world's people live in just 10 countries, all of which have populations exceeding 100 million.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Population density is defined as:",
            options: [
              "The total population of a country",
              "The number of people living in a unit area of the earth's surface",
              "The rate of population growth",
              "The percentage of people employed in agriculture",
            ],
            correct: 1,
            explanation:
              "Population density is the number of people living in a unit area of the earth's surface, normally expressed as persons per square kilometre.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which region of the world is stated to have the highest population density, followed by East and South East Asia?",
            options: ["Western Europe", "South Central Asia", "North America", "Australia"],
            correct: 1,
            explanation:
              "South Central Asia has the highest density of population, followed by East and South East Asia.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "People generally avoid extreme climates such as the Sahara desert and the polar regions of Russia, Canada and Antarctica. This illustrates which type of factor affecting population distribution?",
            options: ["Economic factor", "A geographical (climatic) factor", "Cultural factor", "Social factor"],
            correct: 1,
            explanation:
              "Climate is a geographical factor affecting population distribution — people avoid areas that are extremely hot or extremely cold.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Cities like Varanasi, Jerusalem and Vatican City attract dense population mainly due to their:",
            options: ["Mineral wealth", "Religious or cultural significance", "Fertile soil", "Industrial development"],
            correct: 1,
            explanation:
              "Places with religious or cultural significance, such as Varanasi, Jerusalem and Vatican City, attract dense populations.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Osaka in Japan and Mumbai in India are densely populated mainly due to which factor?",
            options: ["Religious significance", "Economic/industrial employment opportunities", "Extreme climate", "Mineral deposits"],
            correct: 1,
            explanation:
              "Industrial areas provide employment opportunities that attract large numbers of people — Osaka and Mumbai are cited as economically driven densely populated areas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The number of live births per 1,000 people in a given period is called the:",
            options: ["Death rate", "Birth rate", "Natural growth rate", "Migration rate"],
            correct: 1,
            explanation:
              "Births are measured using the birth rate, i.e. the number of live births per 1,000 people.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The difference between the birth rate and the death rate of a country is called the:",
            options: ["Population density", "Natural growth rate", "Population composition", "Dependency ratio"],
            correct: 1,
            explanation:
              "The natural growth rate is the difference between the birth rate and the death rate of a country.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After reaching one billion in 1804 and three billion in 1959, the world's population doubled to six billion (a 'population explosion') in:",
            options: ["1959", "1979", "1999", "2011"],
            correct: 2,
            explanation:
              "The world's population reached one billion in 1804, three billion in 1959, and doubled to six billion in 1999.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "People who leave a country are called emigrants, while people who arrive in a new country are called:",
            options: ["Migrants", "Immigrants", "Nomads", "Settlers"],
            correct: 1,
            explanation:
              "Emigrants are people who leave a country; immigrants are those who arrive in a country.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The United States of America and Australia have gained population mainly through:",
            options: ["High birth rates alone", "In-migration or immigration", "Low death rates only", "Government incentives for large families"],
            correct: 1,
            explanation:
              "The USA and Australia have gained population numbers through in-migration or immigration.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Sudan is given in the chapter as an example of a country that has experienced a loss in population, mainly due to:",
            options: ["High death rate", "Out-migration or emigration", "Low birth rate", "Natural disasters alone"],
            correct: 1,
            explanation:
              "Sudan is cited as an example of a country that has experienced population loss due to out-migration or emigration.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A graphical representation of the age and sex composition of a country's population is called a:",
            options: ["Bar graph", "Population pyramid", "Pie chart", "Line graph"],
            correct: 1,
            explanation:
              "A population pyramid, also called an age-sex pyramid, shows the total population divided into age groups, subdivided into males and females.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In a population pyramid, dependents aged below 15 years are called young dependents, while those aged over 65 are called:",
            options: ["Working dependents", "Elderly dependents", "Economically active", "Migrant dependents"],
            correct: 1,
            explanation:
              "The two groups of dependents are young dependents (below 15 years) and elderly dependents (over 65 years); those of working age are economically active.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A population pyramid that is broad at the base and narrows rapidly towards the top, as seen in Kenya, indicates:",
            options: [
              "Low birth rate and low death rate",
              "High birth rate along with high death rate, especially among infants",
              "An ageing population",
              "A stable, non-growing population",
            ],
            correct: 1,
            explanation:
              "Kenya's pyramid, broad at the base and narrowing rapidly, reflects high birth rates along with high death rates, especially in infancy, so relatively few reach old age.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A population pyramid that is narrow at the base, as seen in Japan, is typically the result of:",
            options: [
              "High birth rates",
              "Low birth rates, along with decreased death rates allowing more people to reach old age",
              "High infant mortality",
              "Large-scale immigration of young workers",
            ],
            correct: 1,
            explanation:
              "In countries like Japan, low birth rates make the pyramid narrow at the base, while decreased death rates allow more people to reach old age.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "india-size-and-location",
        name: "India: Size and Location",
        questions: [
          q({
            text: "India's mainland lies entirely in which hemisphere?",
            options: ["Southern", "Northern", "Eastern only", "Western only"],
            correct: 1,
            explanation:
              "India's mainland extends between latitudes 8°4'N and 37°6'N, lying entirely in the Northern Hemisphere.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The total geographical area of India accounts for approximately what percentage of the world's total area?",
            options: ["1%", "2.4%", "5%", "10%"],
            correct: 1,
            explanation:
              "India's land mass has an area of 3.28 million sq km, which accounts for about 2.4 per cent of the total geographical area of the world.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "India is the ___ largest country in the world by area.",
            options: ["fifth", "sixth", "seventh", "ninth"],
            correct: 2,
            explanation:
              "India is the seventh largest country in the world by area.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "India's total land boundary is approximately:",
            options: ["7,516 km", "12,000 km", "15,200 km", "20,000 km"],
            correct: 2,
            explanation:
              "India has a land boundary of about 15,200 km, while the total length of its coastline (mainland plus islands) is 7,516.6 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which line of latitude divides India into almost two equal halves?",
            options: ["The Equator", "The Tropic of Cancer", "The Tropic of Capricorn", "The Arctic Circle"],
            correct: 1,
            explanation:
              "The Tropic of Cancer (23°30'N) passes through the middle of the country, dividing it into almost two equal parts.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "India's Standard Meridian, 82°30'E, passes through which city, whose local time is taken as the standard time for the whole country?",
            options: ["Allahabad", "Mirzapur", "Varanasi", "Kanpur"],
            correct: 1,
            explanation:
              "The Standard Meridian of India (82°30'E) passes through Mirzapur in Uttar Pradesh, and its time is taken as the Indian Standard Time.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "There is a time lag of how many hours between sunrise in Gujarat (in the west) and Arunachal Pradesh (in the east)?",
            options: ["1 hour", "2 hours", "3 hours", "4 hours"],
            correct: 1,
            explanation:
              "From Gujarat to Arunachal Pradesh, there is a time lag of about two hours, even though watches show the same Indian Standard Time.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's distance from Europe was reduced by about 7,000 km after the opening of which canal in 1869?",
            options: ["The Panama Canal", "The Suez Canal", "The Kiel Canal", "The Corinth Canal"],
            correct: 1,
            explanation:
              "Since the opening of the Suez Canal in 1869, India's distance from Europe has been reduced by 7,000 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "How many states and Union Territories did India have, as stated in the chapter?",
            options: [
              "28 states and 8 Union Territories",
              "25 states and 7 Union Territories",
              "29 states and 6 Union Territories",
              "30 states and 5 Union Territories",
            ],
            correct: 0,
            explanation:
              "India has 28 states and eight Union Territories, occupying an important strategic position in South Asia.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India shares its land boundary with Pakistan and Afghanistan in the northwest, and with Myanmar and which other country in the east?",
            options: ["Bangladesh", "Nepal", "Bhutan", "Sri Lanka"],
            correct: 0,
            explanation:
              "India shares its land boundaries with Pakistan and Afghanistan in the northwest, China (Tibet), Nepal and Bhutan in the north, and Myanmar and Bangladesh in the east.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "India's southern neighbours across the sea are the island countries of Sri Lanka and:",
            options: ["Seychelles", "Maldives", "Mauritius", "Madagascar"],
            correct: 1,
            explanation:
              "India's southern neighbours across the sea are the two island countries, Sri Lanka and Maldives.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Sri Lanka is separated from India by a narrow channel of sea formed by the Palk Strait and the:",
            options: ["Gulf of Kachchh", "Gulf of Mannar", "Gulf of Khambhat", "Ten Degree Channel"],
            correct: 1,
            explanation:
              "Sri Lanka is separated from India by a narrow channel of sea formed by the Palk Strait and the Gulf of Mannar.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "'Indira Point', the southernmost point of the Indian Union, got submerged under the sea in 2004 during:",
            options: ["A severe cyclone", "The Tsunami", "A monsoon flood", "An earthquake alone, with no wave"],
            correct: 1,
            explanation:
              "The southernmost point of the Indian Union, 'Indira Point', got submerged under the sea water in 2004 during the Tsunami.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Lakshadweep islands lie in the Arabian Sea, while the Andaman and Nicobar islands lie in the:",
            options: ["Arabian Sea", "Bay of Bengal", "Indian Ocean, unrelated to any sea", "Pacific Ocean"],
            correct: 1,
            explanation:
              "The Andaman and Nicobar islands lie southeast of the mainland in the Bay of Bengal, while the Lakshadweep islands lie southwest, in the Arabian Sea.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "South of about 22°N latitude, India's landmass begins to taper and divides the ocean into two seas — the Arabian Sea on the west and which sea on the east?",
            options: ["The Bay of Bengal", "The Andaman Sea", "The South China Sea", "The Red Sea"],
            correct: 0,
            explanation:
              "South of about 22° north latitude, India's mainland begins to taper, extending towards the Indian Ocean and dividing it into the Arabian Sea on the west and the Bay of Bengal on the east.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Before 1947, states that were ruled directly by British officials appointed by the Viceroy were called:",
            options: ["Princely states", "Provinces", "Territories", "Dominions"],
            correct: 1,
            explanation:
              "Before 1947, provinces were ruled directly by British officials appointed by the Viceroy, while Princely states were ruled by local, hereditary rulers who acknowledged British sovereignty in return for local autonomy.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's total coastline, including the mainland, Andaman & Nicobar and Lakshadweep, measures approximately:",
            options: ["6,100 km", "7,516.6 km", "10,000 km", "15,200 km"],
            correct: 1,
            explanation:
              "The total length of India's coastline, including the mainland and its islands, is 7,516.6 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Deccan Peninsula's protrusion into the Indian Ocean helps India establish close contact with West Asia and Africa from its western coast, and with which regions from its eastern coast?",
            options: ["Europe", "Southeast and East Asia", "North America", "Australia and New Zealand"],
            correct: 1,
            explanation:
              "The Deccan Peninsula's protrusion into the Indian Ocean helps India establish close contact with West Asia, Africa and Europe from the western coast, and with Southeast and East Asia from the eastern coast.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India occupies a central location between the East and the West Asia, and no other country has as long a coastline on which ocean, which is in fact named after it?",
            options: ["The Pacific Ocean", "The Atlantic Ocean", "The Indian Ocean", "The Arctic Ocean"],
            correct: 2,
            explanation:
              "No other country has as long a coastline on the Indian Ocean as India, and it is India's eminent position in this ocean that justifies naming an ocean after it.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "physical-features-of-india",
        name: "Physical Features of India",
        questions: [
          q({
            text: "The Shiwaliks are separated from the adjoining northern plains by which major geological fault?",
            options: ["The Himalayan Frontal Fault", "The Main Central Thrust", "The Main Boundary Thrust", "The Narmada-Son Fault"],
            correct: 0,
            explanation: "The Himalayan Frontal Fault marks the boundary between the Shiwalik range and the Indo-Gangetic plains to its south.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following states is NOT generally included within the Deccan Plateau region of India?",
            options: ["Gujarat", "Maharashtra", "Karnataka", "Telangana"],
            correct: 0,
            explanation: "The Deccan Plateau covers much of Maharashtra, Karnataka, Telangana and Andhra Pradesh; Gujarat lies to the west and is not part of the Deccan Plateau proper.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following is NOT one of the six major physiographic divisions of India identified in the chapter?",
            options: ["The Himalayan Mountains", "The Northern Plains", "The Deccan Trap", "The Indian Desert"],
            correct: 2,
            explanation:
              "The six major physiographic divisions are the Himalayan Mountains, the Northern Plains, the Peninsular Plateau, the Indian Desert, the Coastal Plains and the Islands — the Deccan Trap is a distinct black-soil region within the Peninsular Plateau, not a separate division.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Himalayas run from the Indus to the Brahmaputra, forming an arc that covers a distance of about:",
            options: ["1,200 km", "2,400 km", "3,600 km", "5,000 km"],
            correct: 1,
            explanation:
              "The Himalayas form an arc covering a distance of about 2,400 km, running west-east from the Indus to the Brahmaputra.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The width of the Himalayas varies from about 400 km in Kashmir to how much in Arunachal Pradesh?",
            options: ["50 km", "150 km", "250 km", "350 km"],
            correct: 1,
            explanation:
              "The Himalayas' width varies from 400 km in Kashmir to just 150 km in Arunachal Pradesh.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The northernmost, most continuous range of the Himalayas, containing the loftiest peaks with an average height of 6,000 metres, is known as:",
            options: ["The Shiwaliks", "The Himachal (Lesser Himalaya)", "The Himadri (Great/Inner Himalaya)", "The Purvachal"],
            correct: 2,
            explanation:
              "The Himadri, or Great/Inner Himalaya, is the northernmost and most continuous range, containing all the prominent Himalayan peaks with an average height of 6,000 metres.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The core of the Great Himalayan range is composed of:",
            options: ["Sandstone", "Granite", "Basalt", "Limestone"],
            correct: 1,
            explanation:
              "The folds of the Great Himalayas are asymmetrical, and the core of this range is composed of granite.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which range of the Lesser Himalaya (Himachal) is described as the longest and most important, alongside the Dhaula Dhar and Mahabharat ranges?",
            options: ["The Pir Panjal range", "The Zaskar range", "The Karakoram range", "The Ladakh range"],
            correct: 0,
            explanation:
              "The Pir Panjal range forms the longest and most important range of the Himachal (Lesser Himalaya).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The famous Valley of Kashmir, along with the Kangra and Kullu valleys, lies within which Himalayan range?",
            options: ["The Himadri", "The Himachal (Lesser Himalaya)", "The Shiwaliks", "The Purvachal"],
            correct: 1,
            explanation:
              "The Himachal or Lesser Himalaya range consists of the famous Valley of Kashmir and the Kangra and Kullu valleys, and is well known for its hill stations.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The outermost range of the Himalayas, composed of unconsolidated sediments with an altitude of 900-1,100 metres, is called:",
            options: ["The Himadri", "The Himachal", "The Shiwaliks", "The Zaskar"],
            correct: 2,
            explanation:
              "The Shiwaliks are the outermost range of the Himalayas, composed of unconsolidated sediments brought down by rivers from the main Himalayan ranges.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The longitudinal valleys lying between the Lesser Himalaya and the Shiwaliks are known as:",
            options: ["Duns", "Doabs", "Bhabar", "Terai"],
            correct: 0,
            explanation:
              "The longitudinal valleys between the Lesser Himalaya and the Shiwaliks are known as Duns; Dehra Dun, Kotli Dun and Patli Dun are well-known examples.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The part of the Himalaya lying between the Indus and Satluj rivers is traditionally known as the:",
            options: ["Kumaon Himalaya", "Nepal Himalaya", "Punjab Himalaya", "Assam Himalaya"],
            correct: 2,
            explanation:
              "The part of the Himalayas lying between the Indus and Satluj rivers is traditionally known as the Punjab Himalaya, also called the Kashmir and Himachal Himalaya regionally.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Purvachal, or Eastern hills, running through the north-eastern states beyond the Dihang gorge, are composed mostly of:",
            options: ["Granite", "Sandstone (sedimentary rocks)", "Basalt", "Marble"],
            correct: 1,
            explanation:
              "The Purvachal hills, running through the north-eastern states, are mostly composed of strong sandstones, which are sedimentary rocks.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT one of the hill ranges comprising the Purvachal?",
            options: ["Patkai hills", "Naga hills", "Aravali hills", "Mizo hills"],
            correct: 2,
            explanation:
              "The Purvachal comprises the Patkai hills, the Naga hills, the Manipur hills and the Mizo hills — the Aravali hills belong to the Peninsular Plateau, not the Purvachal.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Northern Plain of India, formed by the Indus, Ganga and Brahmaputra river systems, spreads over an area of approximately:",
            options: ["3 lakh sq km", "5 lakh sq km", "7 lakh sq km", "10 lakh sq km"],
            correct: 2,
            explanation:
              "The Northern Plain spreads over an area of about 7 lakh sq km, formed by the deposition of alluvium over millions of years.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The western part of the Northern Plain, formed by the Indus and its tributaries and dominated by doabs, is referred to as the:",
            options: ["The Ganga Plains", "The Punjab Plains", "The Brahmaputra Plains", "The Rajasthan Plains"],
            correct: 1,
            explanation:
              "The western part of the Northern Plain is referred to as the Punjab Plains, formed by the Indus and its tributaries and dominated by doabs.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The word 'Doab' is made up of two words meaning:",
            options: ["Two waters", "Five waters", "One water", "Three waters"],
            correct: 0,
            explanation:
              "'Doab' is made up of 'do' meaning two and 'ab' meaning water; similarly, 'Punjab' is made of 'Punj' (five) and 'ab' (water).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The narrow belt at the foothills of the Shiwaliks, about 8-16 km wide, where rivers deposit pebbles and streams disappear, is known as:",
            options: ["Bhangar", "Khadar", "Bhabar", "Terai"],
            correct: 2,
            explanation:
              "The Bhabar is a narrow belt (8-16 km wide) parallel to the Shiwaliks where rivers deposit pebbles and all streams disappear.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "South of the bhabar belt, where streams re-emerge and create a wet, swampy and marshy region, is known as:",
            options: ["Terai", "Bhangar", "Khadar", "Doab"],
            correct: 0,
            explanation:
              "South of the bhabar belt, streams and rivers re-emerge, creating a wet, swampy and marshy region known as the terai.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The older alluvium, forming a terrace-like feature above the floodplains and containing calcareous deposits (kankar), is known as:",
            options: ["Khadar", "Bhangar", "Terai", "Bhabar"],
            correct: 1,
            explanation:
              "The largest part of the northern plain is formed of older alluvium called bhangar, which lies above the floodplains and contains calcareous deposits known locally as kankar.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The newer, younger alluvial deposits of the floodplains, renewed almost every year and ideal for intensive agriculture, are called:",
            options: ["Bhangar", "Bhabar", "Khadar", "Terai"],
            correct: 2,
            explanation:
              "The newer, younger deposits of the floodplains are called khadar; they are renewed almost every year, making them fertile and ideal for intensive agriculture.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Majuli, the largest inhabited riverine island in the world, is formed by which river?",
            options: ["The Ganga", "The Brahmaputra", "The Indus", "The Godavari"],
            correct: 1,
            explanation:
              "Majuli, in the Brahmaputra river, is the largest inhabited riverine island in the world.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Peninsular Plateau was formed due to the breaking and drifting of which ancient landmass?",
            options: ["Pangaea", "Gondwana land", "Laurasia", "Angaraland"],
            correct: 1,
            explanation:
              "The Peninsular Plateau was formed due to the breaking and drifting of the Gondwana land, making it one of the oldest landmasses on earth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The part of the Peninsular Plateau lying north of the Narmada river, covering the Malwa plateau, is known as the:",
            options: ["The Deccan Plateau", "The Central Highlands", "The Chotanagpur Plateau", "The Meghalaya Plateau"],
            correct: 1,
            explanation:
              "The Central Highlands lie north of the Narmada river, covering a major area of the Malwa plateau, bounded by the Vindhyan range.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Vindhyan range is bounded by the Satpura range on the south and which range on the northwest?",
            options: ["The Aravalis", "The Western Ghats", "The Karakoram", "The Sahyadris"],
            correct: 0,
            explanation:
              "The Vindhyan range is bounded by the Satpura range on the south and the Aravalis on the northwest.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Deccan Plateau, a triangular landmass lying south of the river Narmada, is higher in the west and slopes gently towards the:",
            options: ["North", "South", "East", "West"],
            correct: 2,
            explanation:
              "The Deccan Plateau is higher in the west and slopes gently eastwards.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The average elevation of the Western Ghats (900-1,600 metres) is compared to the Eastern Ghats, which average only about:",
            options: ["300 metres", "600 metres", "900 metres", "1,200 metres"],
            correct: 1,
            explanation:
              "The Western Ghats have an average elevation of 900-1,600 metres, considerably higher than the Eastern Ghats' average of about 600 metres.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The highest peak of the Western Ghats mentioned in the chapter is:",
            options: ["Doda Betta", "Anai Mudi", "Mahendragiri", "Kanchenjunga"],
            correct: 1,
            explanation:
              "Anai Mudi (2,695 metres) is the highest peak in the Western Ghats mentioned in the chapter, along with Doda Betta (2,637 metres).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahendragiri, at 1,501 metres, is the highest peak of which mountain range?",
            options: ["The Western Ghats", "The Eastern Ghats", "The Aravalis", "The Vindhyas"],
            correct: 1,
            explanation:
              "Mahendragiri (1,501 metres) is the highest peak in the Eastern Ghats, which are discontinuous and irregular compared to the Western Ghats.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Deccan Trap, a distinct black-soil region of the Peninsular plateau, is of which geological origin?",
            options: ["Sedimentary", "Volcanic (igneous)", "Metamorphic", "Coral"],
            correct: 1,
            explanation:
              "The Deccan Trap is of volcanic origin; the igneous rocks have denuded over time and are responsible for the formation of the region's black soil.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Indian Desert, lying west of the Aravali Hills, receives an annual rainfall of below:",
            options: ["50 mm", "150 mm", "500 mm", "1000 mm"],
            correct: 1,
            explanation:
              "The Indian desert receives very low rainfall, below 150 mm per year, and has an arid climate with low vegetation cover.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which is the only large river flowing through the Indian Desert region?",
            options: ["The Chambal", "The Luni", "The Sabarmati", "The Betwa"],
            correct: 1,
            explanation:
              "The Luni is the only large river in the Indian Desert region; other streams appear during the rainy season and disappear into the sand.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Crescent-shaped sand dunes, which cover large areas of the Indian Desert, are called:",
            options: ["Barchans", "Loess", "Doabs", "Duns"],
            correct: 0,
            explanation:
              "Barchans are crescent-shaped dunes that cover larger areas of the Indian Desert, while longitudinal dunes become more prominent near the Indo-Pakistan boundary.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Along the western coast, the northern section (Mumbai-Goa) is called the Konkan, and the southern section is called the:",
            options: ["The Coromandel Coast", "The Malabar Coast", "The Northern Circar", "The Kannad Plain (central)"],
            correct: 1,
            explanation:
              "The western coast consists of three sections: the northern Konkan (Mumbai-Goa), the central Kannad Plain, and the southern Malabar coast.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Along the eastern coast, the northern part is called the Northern Circar, while the southern part is known as the:",
            options: ["The Konkan coast", "The Malabar coast", "The Coromandel Coast", "The Kannad Plain"],
            correct: 2,
            explanation:
              "Along the Bay of Bengal, the northern part of the coastal plain is called the Northern Circar, while the southern part is known as the Coromandel Coast.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Chilika Lake, the largest saltwater lake in India, lies to the south of the delta of which river, in Odisha?",
            options: ["The Godavari", "The Krishna", "The Mahanadi", "The Kaveri"],
            correct: 2,
            explanation:
              "Chilika Lake, an important feature along the eastern coast and India's largest saltwater lake, lies south of the Mahanadi delta in Odisha.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Lakshadweep islands, composed of small coral islands, were formerly known as Laccadive, Minicoy and:",
            options: ["Amindive", "Nicobar", "Andaman", "Malabar"],
            correct: 0,
            explanation:
              "The Lakshadweep islands were earlier known as Laccadive, Minicoy and Amindive, before being renamed Lakshadweep in 1973.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "India's only active volcano is found on which island of the Andaman and Nicobar group?",
            options: ["Havelock Island", "Barren Island", "Ross Island", "Neil Island"],
            correct: 1,
            explanation:
              "India's only active volcano is found on Barren Island, part of the Andaman and Nicobar group of islands.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "drainage-of-india",
        name: "Drainage",
        questions: [
          q({
            text: "The Ganga river originates from the Gangotri glacier, located in which Indian state?",
            options: ["Uttarakhand", "Himachal Pradesh", "Uttar Pradesh", "Jammu and Kashmir"],
            correct: 0,
            explanation: "The Ganga originates as the Bhagirathi from the Gangotri glacier in Uttarakhand, and is joined by the Alaknanda at Devprayag to form the Ganga proper.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Prayagraj (Allahabad) is famous for the sacred confluence (Sangam) of which two major rivers?",
            options: ["The Ganga and the Yamuna", "The Ganga and the Godavari", "The Yamuna and the Chambal", "The Ganga and the Son"],
            correct: 0,
            explanation: "Prayagraj sits at the confluence of the Ganga and Yamuna rivers (with the mythical Saraswati), a site of great religious significance and the venue of the Kumbh Mela.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The area drained by a single river system is called a:",
            options: ["Water divide", "Drainage basin", "Watershed ridge", "River delta"],
            correct: 1,
            explanation:
              "A drainage basin is the area drained by a single river system, ultimately draining into a large water body such as a lake, sea or ocean.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "An elevated area, such as a mountain or upland, that separates two drainage basins is known as a:",
            options: ["Drainage basin", "Water divide", "Doab", "Watershed plain"],
            correct: 1,
            explanation:
              "Such an elevated area separating two drainage basins is known as a water divide.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The world's largest drainage basin belongs to which river?",
            options: ["The Nile", "The Amazon", "The Ganga", "The Mississippi"],
            correct: 1,
            explanation:
              "The world's largest drainage basin is that of the Amazon river.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Indian rivers are broadly divided into two major groups: the Peninsular rivers and the:",
            options: ["Coastal rivers", "Himalayan rivers", "Desert rivers", "Deltaic rivers"],
            correct: 1,
            explanation:
              "The drainage systems of India are mainly controlled by the broad relief features, dividing Indian rivers into the Himalayan rivers and the Peninsular rivers.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is a distinguishing feature of most Himalayan rivers, unlike Peninsular rivers?",
            options: [
              "They are seasonal and dry up in summer",
              "They are perennial, fed by both rain and melted snow",
              "They have very short courses",
              "They never form deltas",
            ],
            correct: 1,
            explanation:
              "Most Himalayan rivers are perennial, receiving water from rain as well as melted snow from the lofty mountains, unlike the mostly seasonal Peninsular rivers.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The river Indus rises near Lake Mansarowar in:",
            options: ["Nepal", "Tibet", "Ladakh", "Kashmir"],
            correct: 1,
            explanation:
              "The river Indus rises in Tibet near Lake Mansarowar, and flows west to enter India in Ladakh.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Under the Indus Water Treaty of 1960, India is entitled to use what percentage of the total water carried by the Indus river system?",
            options: ["20%", "50%", "80%", "100%"],
            correct: 0,
            explanation:
              "According to the Indus Water Treaty (1960), India can use only 20 per cent of the total water carried by the Indus river system, mainly for irrigation in Punjab, Haryana and Rajasthan.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The headwaters of the River Ganga, known as the 'Bhagirathi', are fed by the:",
            options: ["Yamunotri Glacier", "Gangotri Glacier", "Siachen Glacier", "Pindari Glacier"],
            correct: 1,
            explanation:
              "The headwaters of the Ganga, called the 'Bhagirathi', are fed by the Gangotri Glacier.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Bhagirathi is joined by the Alaknanda at which town in Uttarakhand, to form the Ganga?",
            options: ["Haridwar", "Rishikesh", "Devaprayag", "Rudraprayag"],
            correct: 2,
            explanation:
              "The Bhagirathi is joined by the Alaknanda at Devaprayag in Uttarakhand to form the Ganga, which emerges from the mountains onto the plains at Haridwar.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The river Yamuna, a right-bank tributary of the Ganga, rises from the Yamunotri Glacier and meets the Ganga at:",
            options: ["Haridwar", "Allahabad", "Varanasi", "Patna"],
            correct: 1,
            explanation:
              "The Yamuna rises from the Yamunotri Glacier, flows parallel to the Ganga, and meets it at Allahabad as a right-bank tributary.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following rivers, rising in the Nepal Himalaya, are known to flood parts of the northern plains every year?",
            options: [
              "The Chambal, the Betwa and the Son",
              "The Ghaghara, the Gandak and the Kosi",
              "The Damodar, the Brahmani and the Baitarni",
              "The Sabarmati, the Mahi and the Periyar",
            ],
            correct: 1,
            explanation:
              "The Ghaghara, the Gandak and the Kosi, which rise in the Nepal Himalaya, flood parts of the northern plains every year, though they also enrich the soil for agriculture.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The delta formed at the meeting of the Ganga and the Brahmaputra (known there as the Meghna) is called:",
            options: ["The Godavari Delta", "The Sundarban Delta", "The Mahanadi Delta", "The Krishna Delta"],
            correct: 1,
            explanation:
              "The delta formed by the combined waters of the Ganga and Brahmaputra (known as the Meghna downstream) is called the Sundarban Delta.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Sundarban Delta derives its name from which tree, which grows well in marshland?",
            options: ["Teak", "Sundari", "Sal", "Deodar"],
            correct: 1,
            explanation:
              "The Sundarban Delta derived its name from the Sundari tree, which grows well in marshland.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Sundarban Delta is described in the chapter as the world's largest and fastest growing delta, and is also the home of the:",
            options: ["Asiatic Lion", "Royal Bengal Tiger", "One-horned Rhinoceros", "Snow Leopard"],
            correct: 1,
            explanation:
              "The Sundarban Delta is the world's largest and fastest growing delta, and is also the home of the Royal Bengal Tiger.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Ambala is located on the water divide between which two river systems?",
            options: ["The Ganga and the Brahmaputra", "The Indus and the Ganga", "The Narmada and the Tapi", "The Godavari and the Krishna"],
            correct: 1,
            explanation:
              "Ambala is located on the water divide between the Indus and the Ganga river systems.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The river Brahmaputra rises in Tibet, where it is known as the:",
            options: ["Dihang", "Tsang Po", "Jamuna", "Lohit"],
            correct: 1,
            explanation:
              "The Brahmaputra is known as the Tsang Po in Tibet, and as the Jamuna in Bangladesh.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On reaching Namcha Barwa, the Brahmaputra takes a sharp 'U' turn and enters India in which state?",
            options: ["Assam", "Arunachal Pradesh", "Sikkim", "West Bengal"],
            correct: 1,
            explanation:
              "On reaching Namcha Barwa (7,757 m), the Brahmaputra takes a 'U' turn and enters India in Arunachal Pradesh through a gorge, where it is called the Dihang.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Bangladesh, the Brahmaputra is known by which name?",
            options: ["Tsang Po", "Dihang", "Jamuna", "Padma"],
            correct: 2,
            explanation:
              "The Brahmaputra is known as the Tsang Po in Tibet and as the Jamuna in Bangladesh.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Brahmaputra is marked by huge deposits of silt on its bed, causing the riverbed to rise, and it also frequently:",
            options: ["Dries up completely", "Shifts its channel", "Freezes in winter", "Reverses its flow"],
            correct: 1,
            explanation:
              "Unlike other north Indian rivers, the Brahmaputra is marked by huge silt deposits causing its riverbed to rise, and the river also shifts its channel frequently.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The main water divide of Peninsular India, running north to south close to the western coast, is formed by the:",
            options: ["The Vindhyas", "The Western Ghats", "The Aravalis", "The Satpuras"],
            correct: 1,
            explanation:
              "The main water divide in Peninsular India is formed by the Western Ghats, which runs from north to south close to the western coast.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which two long Peninsular rivers are exceptional in flowing west and forming estuaries rather than deltas?",
            options: ["Godavari and Krishna", "Narmada and Tapi", "Mahanadi and Kaveri", "Sabarmati and Mahi"],
            correct: 1,
            explanation:
              "The Narmada and the Tapi are the only long Peninsular rivers that flow west and form estuaries, unlike the eastward-flowing rivers which form deltas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Narmada rises in the Amarkantak hills in Madhya Pradesh and flows west through a valley formed due to:",
            options: ["Erosion", "Faulting (a rift valley)", "Glaciation", "Volcanic activity"],
            correct: 1,
            explanation:
              "The Narmada rises in the Amarkantak hills and flows west in a rift valley formed due to faulting.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Near Jabalpur, the Narmada flows through a deep gorge creating a scenic feature known as the:",
            options: ["Dhuadhar Falls", "Marble Rocks", "Shivasamudram Falls", "Jog Falls"],
            correct: 1,
            explanation:
              "The 'Marble Rocks' near Jabalpur, where the Narmada flows through a deep gorge, and the Dhuadhar Falls are notable features created by the Narmada.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Tapi river rises in the Satpura ranges, in the Betul district of:",
            options: ["Gujarat", "Maharashtra", "Madhya Pradesh", "Chhattisgarh"],
            correct: 2,
            explanation:
              "The Tapi rises in the Satpura ranges, in the Betul district of Madhya Pradesh, and flows in a rift valley parallel to the Narmada, though it is much shorter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Godavari, the largest Peninsular river, rises from the Western Ghats in the Nasik district of Maharashtra and is also known as the:",
            options: ["Uttar Ganga", "Dakshin Ganga", "Purv Ganga", "Paschim Ganga"],
            correct: 1,
            explanation:
              "Because of its length and the area it covers, the Godavari — the largest Peninsular river with the largest drainage basin among them — is also known as the Dakshin Ganga.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Mahanadi rises in the highlands of Chhattisgarh and flows through which state to reach the Bay of Bengal?",
            options: ["Andhra Pradesh", "Odisha", "West Bengal", "Tamil Nadu"],
            correct: 1,
            explanation:
              "The Mahanadi rises in the highlands of Chhattisgarh and flows through Odisha to reach the Bay of Bengal.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Krishna river rises from a spring near:",
            options: ["Mahabaleshwar", "Amarkantak", "Brahmagiri", "Nasik"],
            correct: 0,
            explanation:
              "The Krishna rises from a spring near Mahabaleshwar and flows for about 1,400 km before reaching the Bay of Bengal.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Kaveri river rises in the Brahmagiri range of the Western Ghats and reaches the Bay of Bengal south of which Tamil Nadu town?",
            options: ["Chennai", "Cuddalore", "Rameswaram", "Madurai"],
            correct: 1,
            explanation:
              "The Kaveri rises in the Brahmagiri range and reaches the Bay of Bengal south of Cuddalore in Tamil Nadu.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Kaveri makes the second biggest waterfall in India, known as the:",
            options: ["Jog Falls", "Shivasamudram Falls", "Dhuadhar Falls", "Athirappilly Falls"],
            correct: 1,
            explanation:
              "The Kaveri makes the second biggest waterfall in India, known as the Shivasamudram Falls, whose hydroelectric power is supplied to Mysuru, Bengaluru and the Kolar Gold Field.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Wular Lake in Jammu and Kashmir, the largest freshwater lake in India, was formed as a result of:",
            options: ["Glacial action", "Tectonic activity", "Wind erosion", "Human construction"],
            correct: 1,
            explanation:
              "Unlike most other Himalayan freshwater lakes (which are of glacial origin), the Wular Lake is the result of tectonic activity, and is the largest freshwater lake in India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Sambhar Lake in Rajasthan, a seasonal lake formed by inland drainage, is notable for being a:",
            options: ["Freshwater lake used for irrigation", "Salt water lake used for producing salt", "Glacial lake", "Artificial reservoir"],
            correct: 1,
            explanation:
              "The Sambhar Lake in Rajasthan is a seasonal salt water lake, and its water is used for producing salt.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Guru Gobind Sagar, an artificial lake formed by the damming of a river for hydel power, is associated with which project?",
            options: ["The Bhakra Nangal Project", "The Hirakud Project", "The Nagarjuna Sagar Project", "The Tehri Dam Project"],
            correct: 0,
            explanation:
              "The Guru Gobind Sagar lake was formed by damming a river as part of the Bhakra Nangal Project, generating hydel power.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The river cleaning programme in India was first initiated with the launch of the Ganga Action Plan in 1985, which was expanded in 1995 to cover other rivers under the:",
            options: [
              "National River Conservation Plan (NRCP)",
              "Namami Gange Programme",
              "Swachh Bharat Mission",
              "Jal Jeevan Mission",
            ],
            correct: 0,
            explanation:
              "The Ganga Action Plan (1985) was expanded to cover other rivers under the National River Conservation Plan (NRCP) in 1995, aiming to improve river water quality through pollution abatement.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "climate-of-india",
        name: "Climate",
        questions: [
          q({
            text: "Climate refers to the sum total of weather conditions over a large area for a period of more than:",
            options: ["1 year", "10 years", "30 years", "100 years"],
            correct: 2,
            explanation:
              "Climate refers to the sum total of weather conditions and variations over a large area for a long period of time — more than thirty years.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The word 'monsoon' is derived from the Arabic word 'mausim', which means:",
            options: ["Rain", "Wind", "Season", "Storm"],
            correct: 2,
            explanation:
              "The word monsoon is derived from the Arabic word 'mausim', which literally means season.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "'Monsoon' specifically refers to:",
            options: [
              "A type of rainfall only",
              "The seasonal reversal in wind direction during a year",
              "A permanent wind blowing year-round",
              "A local wind of northern India",
            ],
            correct: 1,
            explanation:
              "Monsoon refers to the seasonal reversal in the wind direction during a year.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is NOT listed among the six major controls of India's climate?",
            options: ["Latitude", "Altitude", "Distance from the sea", "Population density"],
            correct: 3,
            explanation:
              "The six major climatic controls are latitude, altitude, pressure and wind system, distance from the sea (continentality), ocean currents, and relief features.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Himalayas, with an average height of about 6,000 metres, play a crucial climatic role by:",
            options: [
              "Blocking monsoon winds from entering India",
              "Preventing cold winds from Central Asia from entering the subcontinent",
              "Causing India's summers to be extremely cold",
              "Increasing the salinity of coastal waters",
            ],
            correct: 1,
            explanation:
              "The Himalayas prevent cold winds from Central Asia from entering the subcontinent, giving India comparatively milder winters than Central Asia.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The apparent force caused by the earth's rotation, which deflects winds to the right in the Northern Hemisphere, is called the:",
            options: ["Ferrel force", "Coriolis force", "Monsoon force", "Trade force"],
            correct: 1,
            explanation:
              "The Coriolis force, also known as Ferrel's Law, is the apparent force caused by the earth's rotation, deflecting winds to the right in the Northern Hemisphere.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The northeasterly winds that blow over India for most of the year originate from the subtropical high-pressure belt and generally bring:",
            options: ["Heavy rainfall", "Little or no rain, since they blow over land", "Only winter snow", "Cyclonic storms"],
            correct: 1,
            explanation:
              "These northeasterly winds originate and blow over land, carrying little moisture, and therefore bring little or no rain.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Southwest Monsoon winds, which bring widespread rainfall to India, originate from a high-pressure area over the:",
            options: ["Central Asian plateau", "Southern Indian Ocean", "Arabian desert", "Tibetan plateau"],
            correct: 1,
            explanation:
              "The Southwest Monsoon winds originate from a high-pressure area over the southern Indian Ocean, cross the equator, and turn towards the low-pressure areas over the Indian subcontinent.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The cold weather season in northern India lasts roughly from mid-November to February, with December and January being the:",
            options: ["Wettest months", "Coldest months", "Hottest months", "Most humid months"],
            correct: 1,
            explanation:
              "December and January are the coldest months in the northern part of India during the cold weather season.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "During winter, the Tamil Nadu coast receives some rainfall from the northeast trade winds because, in this region, these winds blow:",
            options: ["From land to sea", "From sea to land", "Only at night", "Only during cyclones"],
            correct: 1,
            explanation:
              "The northeast trade winds are dry over most of the country as they blow from land to sea, but on the Tamil Nadu coast they blow from sea to land, bringing some rainfall.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Winter rains over the northern plains and snowfall in the mountains, though small in total amount, are locally known as 'mahawat' and are important for cultivation of:",
            options: ["Kharif crops", "Rabi crops", "Zaid crops", "Plantation crops"],
            correct: 1,
            explanation:
              "The winter rainfall, locally known as 'mahawat', is of immense importance for the cultivation of rabi crops, even though its total amount is small.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The low-pressure systems that bring winter rain to northern India originate over the Mediterranean Sea and western Asia, and are known as:",
            options: ["Tropical cyclones", "Western cyclonic disturbances", "Monsoon depressions", "Loo storms"],
            correct: 1,
            explanation:
              "Western cyclonic disturbances, originating over the Mediterranean Sea and western Asia, move into India along the westerly flow and cause the winter rains.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The hot, dry, strong winds that blow during the day over north and northwestern India in the hot weather season are called:",
            options: ["Kaal Baisakhi", "Loo", "Chinook", "Mawsim"],
            correct: 1,
            explanation:
              "The 'loo' is a strong, gusty, hot, dry wind blowing during the day over north and northwestern India in the hot weather season; direct exposure can even be fatal.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Thunderstorms accompanied by violent winds and torrential downpours, common in West Bengal during the hot weather season, are locally known as:",
            options: ["Loo", "Kaal Baisakhi", "Mango showers", "Mahawat"],
            correct: 1,
            explanation:
              "In West Bengal, localised thunderstorms with violent winds and torrential downpours during the hot weather season are known as 'Kaal Baisakhi'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Pre-monsoon showers common in Kerala and Karnataka, which help in the early ripening of mangoes, are called:",
            options: ["Kaal Baisakhi", "Mango showers", "Loo", "Mahawat"],
            correct: 1,
            explanation:
              "Towards the close of the summer season, pre-monsoon showers common in Kerala and Karnataka are often referred to as 'mango showers'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The southeast trade winds of the southern hemisphere, which cross the equator and enter India as the southwest monsoon, blow at an average velocity of about:",
            options: ["10 km/hour", "30 km/hour", "60 km/hour", "100 km/hour"],
            correct: 1,
            explanation:
              "The southwest monsoon winds are strong and blow at an average velocity of 30 km per hour.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "With the exception of the extreme northwest, the southwest monsoon winds cover the entire country in about:",
            options: ["A week", "A month", "Three months", "Six months"],
            correct: 1,
            explanation:
              "With the exception of the extreme north-west, the monsoon winds cover the country in about a month.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mawsynram, in the southern ranges of the Khasi Hills, is famous for receiving:",
            options: [
              "No rainfall at all",
              "The highest average rainfall in the world",
              "Only winter snowfall",
              "Rainfall exclusively from cyclones",
            ],
            correct: 1,
            explanation:
              "Mawsynram, in the southern ranges of the Khasi Hills, receives the highest average rainfall in the world.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The tendency of the monsoon to have alternating wet and dry spells, related to the movement of the monsoon trough, is referred to as:",
            options: ["Monsoon retreat", "'Breaks' in the monsoon", "Monsoon depression", "Coriolis deflection"],
            correct: 1,
            explanation:
              "'Breaks' in the monsoon refer to the tendency of the monsoon rains to occur only for a few days at a time, interspersed with rainless intervals.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During October-November, the withdrawal of the southwest monsoon from northern India is marked by clear skies, and the oppressive weather caused by high temperature and humidity is called:",
            options: ["Loo", "October heat", "Kaal Baisakhi", "Mahawat"],
            correct: 1,
            explanation:
              "The oppressive weather during the day, caused by high temperature and humidity as the monsoon retreats, is commonly known as 'October heat'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "By early November, the low-pressure conditions over northwestern India shift to the Bay of Bengal, causing cyclonic depressions that generally originate over the:",
            options: ["Arabian Sea", "Andaman Sea", "Laccadive Sea", "Persian Gulf"],
            correct: 1,
            explanation:
              "These cyclonic depressions, associated with the shift of low pressure to the Bay of Bengal by early November, originate over the Andaman Sea.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which deltas on the eastern coast are frequently struck by destructive tropical cyclones during the retreating monsoon season?",
            options: [
              "The deltas of the Indus and Sutlej",
              "The deltas of the Godavari, Krishna and Kaveri",
              "The deltas of the Narmada and Tapi",
              "The deltas of the Ganga and Yamuna",
            ],
            correct: 1,
            explanation:
              "The thickly populated deltas of the Godavari, the Krishna and the Kaveri are frequently struck by destructive tropical cyclones.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Parts of the western coast and northeastern India receive over how much rainfall annually?",
            options: ["100 cm", "200 cm", "400 cm", "600 cm"],
            correct: 2,
            explanation:
              "Parts of the western coast and northeastern India receive over about 400 cm of rainfall annually.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is described as a region of low precipitation, alongside western Rajasthan/Gujarat and the interior Deccan plateau?",
            options: ["Around Leh in Jammu and Kashmir", "The Malabar coast", "The Sundarbans", "Meghalaya"],
            correct: 0,
            explanation:
              "A third area of low precipitation, apart from western Rajasthan/Gujarat and the interior Deccan plateau, is around Leh in Jammu and Kashmir.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rainfall variability from year to year is described as high in regions of low rainfall, such as Rajasthan, Gujarat and the leeward side of the Western Ghats, making these areas prone to:",
            options: ["Floods", "Droughts", "Cyclones", "Landslides"],
            correct: 1,
            explanation:
              "Areas of low rainfall with high year-to-year variability, such as Rajasthan, Gujarat and the leeward side of the Western Ghats, are drought-prone.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "natural-vegetation-and-wildlife-of-india",
        name: "Natural Vegetation and Wildlife of India",
        questions: [
          q({
            text: "Temperate forests in India, characterised by coniferous and broad-leaved species such as oak and deodar, are mainly found in:",
            options: ["The Himalayan region above about 2,000 metres", "The coastal plains of peninsular India", "The Thar Desert margins", "The Deccan lava plateau"],
            correct: 0,
            explanation: "Temperate forests in India occur mainly in the Himalayan region at altitudes above roughly 2,000 metres, where cooler climates support coniferous species like pine and deodar along with broad-leaved oaks.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "India is recognised as one of the world's 12 'mega biodiversity' countries, occupying which rank in the world for plant diversity?",
            options: ["4th", "6th", "10th", "15th"],
            correct: 2,
            explanation:
              "With about 47,000 plant species, India occupies tenth place in the world (and fourth in Asia) in plant diversity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India accounts for what share of the world's total number of flowering plants?",
            options: ["2%", "6%", "15%", "25%"],
            correct: 1,
            explanation:
              "There are about 15,000 flowering plants in India, which account for 6 per cent of the world's total number of flowering plants.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Natural vegetation, or 'virgin vegetation', refers to plant communities that have:",
            options: [
              "Been cultivated by farmers",
              "Grown naturally without human aid and remained undisturbed for a long time",
              "Been planted in botanical gardens",
              "Been imported from other countries",
            ],
            correct: 1,
            explanation:
              "Natural vegetation refers to a plant community that has grown naturally without human aid and has been left undisturbed for a long time — cultivated crops and orchards are not natural vegetation.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Plant species that are purely Indian (native) are termed endemic or indigenous, while those that have come from outside India are called:",
            options: ["Invasive", "Exotic", "Alien", "Foreign"],
            correct: 1,
            explanation:
              "Virgin vegetation that is purely Indian is called endemic or indigenous, while species that have come from outside India are termed exotic plants.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The term used to denote plants of a particular region or period is 'flora', while the term for animal species of a region is:",
            options: ["Biota", "Fauna", "Ecosystem", "Habitat"],
            correct: 1,
            explanation:
              "The term flora denotes plants of a particular region or period, while fauna refers to animal species.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Tropical Evergreen Forests, found in areas with more than 200 cm of rainfall and a short dry season, are restricted mainly to the Western Ghats and:",
            options: [
              "The Thar Desert and Rajasthan",
              "The island groups, upper Assam and the Tamil Nadu coast",
              "The northern plains of Punjab and Haryana",
              "The Deccan Trap region",
            ],
            correct: 1,
            explanation:
              "Tropical Evergreen Forests are restricted to the heavy rainfall areas of the Western Ghats, the island groups of Lakshadweep and Andaman & Nicobar, upper parts of Assam, and the Tamil Nadu coast.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is a commercially important tree of the Tropical Evergreen Forests?",
            options: ["Deodar", "Ebony", "Babool", "Khejri"],
            correct: 1,
            explanation:
              "Ebony, mahogany, rosewood, rubber and cinchona are commercially important trees of the Tropical Evergreen Forests.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tropical Deciduous Forests, the most widespread forests of India, are also known as:",
            options: ["Rain forests", "Monsoon forests", "Thorn forests", "Alpine forests"],
            correct: 1,
            explanation:
              "Tropical Deciduous Forests, the most widespread forests of India, are also called the monsoon forests.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Moist deciduous forests, found in areas receiving 200-100 cm rainfall, are dominated by which tree species?",
            options: ["Teak", "Deodar", "Acacia", "Sundari"],
            correct: 0,
            explanation:
              "Teak is the most dominant species of moist deciduous forests, along with bamboo, sal, shisham, sandalwood, khair, kusum, arjun and mulberry.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Dry deciduous forests, found in the rainier parts of the Peninsular plateau and the plains of Bihar and UP, occur in areas with rainfall between:",
            options: ["200 and 100 cm", "100 and 70 cm", "70 and 50 cm", "Below 50 cm"],
            correct: 1,
            explanation:
              "Dry deciduous forests are found in areas with rainfall between 100 cm and 70 cm, with open stretches of teak, sal, peepal and neem.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tropical Thorn Forests and Scrubs, found in the semi-arid parts of Gujarat, Rajasthan, MP and Haryana, occur in regions with rainfall of less than:",
            options: ["200 cm", "150 cm", "100 cm", "70 cm"],
            correct: 3,
            explanation:
              "In regions with less than 70 cm of rainfall, the natural vegetation consists of thorny trees and bushes such as acacias, palms, euphorbias and cacti.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Montane Forests, wet temperate forests dominated by evergreen broad-leaf trees like oaks and chestnuts are found between which altitudes?",
            options: ["500-1000 metres", "1000-2000 metres", "2000-3000 metres", "3000-4000 metres"],
            correct: 1,
            explanation:
              "Wet temperate forests, with evergreen broad-leaf trees such as oaks and chestnuts, are found between a height of 1,000 and 2,000 metres.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Coniferous trees like pine, deodar, silver fir, spruce and cedar are found between 1,500 and 3,000 metres, mostly on the southern slopes of:",
            options: ["The Aravalis", "The Himalayas", "The Western Ghats", "The Vindhyas"],
            correct: 1,
            explanation:
              "Between 1,500 and 3,000 metres, coniferous trees cover the southern slopes of the Himalayas, as well as places of high altitude in southern and north-east India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "At altitudes generally above 3,600 metres, temperate forests and grasslands give way to which type of vegetation?",
            options: ["Mangrove vegetation", "Alpine vegetation", "Thorn scrub", "Tropical evergreen"],
            correct: 1,
            explanation:
              "At high altitudes, generally above 3,600 metres, temperate forests and grasslands give way to the Alpine vegetation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Nomadic tribes like the Gujjars and the Bakarwals extensively use which vegetation zone for grazing?",
            options: ["Mangrove forests", "Alpine grasslands", "Tropical thorn forests", "Coastal plains"],
            correct: 1,
            explanation:
              "The Alpine grasslands are used extensively for grazing by nomadic tribes such as the Gujjars and the Bakarwals.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mangrove forests, found in tidal coastal areas with mud and silt accumulation, are best developed in the deltas of the Ganga, Mahanadi, Krishna, Godavari and:",
            options: ["Narmada", "Tapi", "Kaveri", "Indus"],
            correct: 2,
            explanation:
              "The deltas of the Ganga, the Mahanadi, the Krishna, the Godavari and the Kaveri are covered by dense mangrove vegetation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Ganga-Brahmaputra delta, which tree, providing durable hard timber, is a common mangrove species that gives the Sundarbans its name?",
            options: ["Teak", "Sundari", "Deodar", "Sal"],
            correct: 1,
            explanation:
              "Sundari trees, found in the Ganga-Brahmaputra delta, provide durable hard timber, and it is after these trees that the Sundarbans is named.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which animal is described as the famous inhabitant of the mangrove forests of the Sundarbans?",
            options: ["Asiatic Lion", "Royal Bengal Tiger", "Snow Leopard", "One-horned Rhinoceros"],
            correct: 1,
            explanation:
              "The Royal Bengal Tiger is the famous animal of the mangrove forests, along with turtles, crocodiles, gharials and snakes.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "India is the only country in the world that has both:",
            options: ["Elephants and rhinoceros", "Tigers and lions", "Leopards and cheetahs", "Bears and pandas"],
            correct: 1,
            explanation:
              "India is the only country in the world that has both tigers and lions, with the Asiatic lion's natural habitat being the Gir Forest in Gujarat.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Gir Forest, the natural habitat of the Asiatic lion, is located in which state?",
            options: ["Madhya Pradesh", "Gujarat", "Rajasthan", "Maharashtra"],
            correct: 1,
            explanation:
              "The Gir Forest, the last remaining habitat of the Asiatic lion, is located in Gujarat.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The gharial, found in Indian rivers, lakes and coastal areas, is notable for being:",
            options: [
              "An extinct species",
              "The only representative of a variety of crocodile found in the world today",
              "Found only in the Himalayas",
              "A type of freshwater turtle",
            ],
            correct: 1,
            explanation:
              "The gharial is the only representative of a particular variety of crocodile found in the world today.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Wildlife Protection Act, a key legal step in conserving India's fauna, was implemented in:",
            options: ["1952", "1972", "1985", "1995"],
            correct: 1,
            explanation:
              "The Wildlife Protection Act was implemented in India in 1972.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "How many biosphere reserves have been set up in India to protect flora and fauna, according to the chapter?",
            options: ["10", "12", "18", "25"],
            correct: 2,
            explanation:
              "Eighteen biosphere reserves have been set up in India to protect flora and fauna, of which twelve are part of the world network of biosphere reserves.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is one of India's biosphere reserves included in the world network, as listed in the chapter?",
            options: ["Kaziranga", "The Sundarbans", "Corbett", "Bandipur"],
            correct: 1,
            explanation:
              "The Sundarbans is among the twelve Indian biosphere reserves included in the world network, along with Nanda Devi, the Gulf of Mannar, the Nilgiri and others.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Government conservation initiatives mentioned in the chapter include Project Tiger, Project Rhino, and:",
            options: ["Project Elephant", "Project Great Indian Bustard", "Project Leopard", "Project Lion"],
            correct: 1,
            explanation:
              "Project Tiger, Project Rhino, Project Great Indian Bustard and many other eco-developmental projects have been introduced to protect India's wildlife.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Rann of Kachchh is a notable habitat for which migratory bird that builds nest mounds from salty mud?",
            options: ["Siberian Crane", "Flamingo", "Peacock", "Sarus Crane"],
            correct: 1,
            explanation:
              "The Rann of Kachchh, where the desert merges with the sea, is favoured by flamingos, which come in thousands to build nest mounds from the salty mud.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "population-of-india",
        name: "Population",
        questions: [
          q({
            text: "The dependency ratio, which measures the proportion of dependents (children and the elderly) to the working-age population, is calculated primarily on the basis of:",
            options: ["Age", "Sex", "Religion", "Occupation"],
            correct: 0,
            explanation: "The dependency ratio classifies population into age groups — typically 0-14, 15-59 and 60+ — comparing dependents to the working-age population, and is therefore based on age structure.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The theory of optimum population holds that, for a given level of technology and resources, a country's population growth should ideally be understood in relation to:",
            options: ["Overpopulation relative to available resources", "Religious composition", "Urban-rural migration alone", "Sex ratio alone"],
            correct: 0,
            explanation: "The optimum population theory relates the size of population to available resources and technology, with 'overpopulation' referring to a population exceeding what resources can sustainably support.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The extremely uneven distribution of India's population across states and regions is mainly attributable to:",
            options: ["Variations in physical and climatic conditions across regions", "Uniform government policy", "Identical soil fertility everywhere", "Equal availability of water resources"],
            correct: 0,
            explanation: "India's population distribution is markedly uneven mainly because physical factors such as terrain, climate, soil fertility and water availability vary greatly across regions, favouring dense settlement in fertile plains and coastal areas over hilly or arid tracts.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "As per the 2011 Census, India's population accounted for approximately what percentage of the world's total population?",
            options: ["10%", "17.5%", "25%", "30%"],
            correct: 1,
            explanation:
              "India's population as on March 2011 stood at 1,210.6 million, accounting for 17.5 per cent of the world's population.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the 2011 Census, which was the most populous state of India?",
            options: ["Maharashtra", "Bihar", "Uttar Pradesh", "West Bengal"],
            correct: 2,
            explanation:
              "Uttar Pradesh, with a population of 199 million, was the most populous state of India, accounting for about 16 per cent of the country's population.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Almost half of India's population lives in just five states: Uttar Pradesh, Maharashtra, Bihar, West Bengal and:",
            options: ["Rajasthan", "Andhra Pradesh", "Madhya Pradesh", "Tamil Nadu"],
            correct: 1,
            explanation:
              "Almost half of India's population lives in just five states — Uttar Pradesh, Maharashtra, Bihar, West Bengal and Andhra Pradesh.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rajasthan, the largest state of India by area, accounts for only about what share of the country's total population?",
            options: ["1%", "5.5%", "10%", "16%"],
            correct: 1,
            explanation:
              "Rajasthan, the biggest state in terms of area, has only 5.5 per cent of the total population of India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's first census was held in 1872, but the first COMPLETE census of the country was conducted in:",
            options: ["1872", "1881", "1901", "1921"],
            correct: 1,
            explanation:
              "The first census in India was held in 1872, but the first complete census was taken in 1881, and censuses have been held every tenth year since.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Since 1881, the Indian census has been conducted regularly every:",
            options: ["5 years", "10 years", "15 years", "20 years"],
            correct: 1,
            explanation:
              "Since the first complete census in 1881, censuses have been held regularly every tenth year.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Population density is defined as the number of persons per:",
            options: ["Village", "Household", "Unit area", "District"],
            correct: 2,
            explanation:
              "Population density is calculated as the number of persons per unit area, providing a better picture of the uneven distribution of population.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the 2011 Census, what was India's population density (persons per sq km)?",
            options: ["200", "382", "500", "1,102"],
            correct: 1,
            explanation:
              "The population density of India in 2011 was 382 persons per sq km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "As of the 2011 Census, which state recorded the highest population density in India, at 1,102 persons per sq km?",
            options: ["Uttar Pradesh", "West Bengal", "Bihar", "Kerala"],
            correct: 2,
            explanation:
              "Bihar recorded the highest population density among Indian states, at 1,102 persons per sq km, according to the chapter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which state recorded the lowest population density in India, at just 17 persons per sq km, as per the 2011 Census?",
            options: ["Sikkim", "Arunachal Pradesh", "Mizoram", "Nagaland"],
            correct: 1,
            explanation:
              "Arunachal Pradesh had the lowest population density in India, at only 17 persons per sq km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's population grew from 361 million in 1951 to how much in 2011?",
            options: ["683 million", "846 million", "1,028.7 million", "1,210.6 million"],
            correct: 3,
            explanation:
              "India's population has been steadily increasing, from 361 million in 1951 to 1,210.6 million in 2011.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Since 1981, India's annual rate of population growth has been:",
            options: ["Increasing steadily", "Declining gradually", "Remaining exactly constant", "Fluctuating randomly with no trend"],
            correct: 1,
            explanation:
              "From 1951 to 1981, the annual growth rate was steadily increasing, but since 1981, it has started declining gradually due to falling birth rates.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Despite a declining growth rate since 1981, the absolute number of people added to India's population each decade has continued to be large mainly because:",
            options: [
              "Birth rates suddenly increased again",
              "India has a very large population base, so even a lower rate yields a large absolute increase",
              "Death rates increased sharply",
              "Migration from other countries increased",
            ],
            correct: 1,
            explanation:
              "When more than a billion people increase even at a lower rate, the total number added becomes very large — a large population base means even a low annual rate yields a large absolute increase.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's population may overtake China's around 2045 to become:",
            options: [
              "The second most populous country in the world",
              "The most populous country in the world",
              "A country with a declining population",
              "The most densely populated country in the world",
            ],
            correct: 1,
            explanation:
              "The chapter notes that India may overtake China in 2045 to become the most populous country in the world.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The three main processes responsible for population change are birth rates, death rates and:",
            options: ["Literacy", "Migration", "Urbanisation", "Industrialisation"],
            correct: 1,
            explanation:
              "The three main processes of population change are birth rates, death rates and migration.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The number of live births per thousand persons in a year is called the:",
            options: ["Growth rate", "Birth rate", "Death rate", "Natural increase"],
            correct: 1,
            explanation:
              "The birth rate is the number of live births per thousand persons in a year, and has always been higher than the death rate in India.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Migration that occurs within the boundaries of a country, which does not change the national population size but affects its distribution, is called:",
            options: ["International migration", "Internal migration", "Net migration", "Circular migration"],
            correct: 1,
            explanation:
              "Internal migration does not change the size of the total population but influences the distribution of population within the nation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In India, most rural-to-urban migration has been driven by the 'push' factor of poverty and unemployment in rural areas, combined with the 'pull' factor of:",
            options: [
              "Cooler climate in cities",
              "Increased employment opportunities and better living conditions in cities",
              "Lower cost of living in cities",
              "Government relocation orders",
            ],
            correct: 1,
            explanation:
              "Rural-to-urban migration in India results from the 'push' of poverty and unemployment in rural areas, and the 'pull' of increased employment opportunities and better living conditions in cities.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's urban population increased from 17.29 per cent of the total population in 1951 to what percentage in 2011?",
            options: ["21.80%", "25.50%", "31.80%", "40.00%"],
            correct: 2,
            explanation:
              "The urban population has increased from 17.29 per cent of the total population in 1951 to 31.80 per cent in 2011.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The adolescent population of India, generally grouped in the age group of 10 to 19 years, constitutes approximately what fraction of the country's total population?",
            options: ["One-tenth", "One-fifth", "One-third", "One-half"],
            correct: 1,
            explanation:
              "The adolescent population, grouped in the age group of 10 to 19 years, constitutes one-fifth of the total population of India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The National Population Policy (NPP) 2000 set a goal of reducing the infant mortality rate to below:",
            options: ["10 per 1000 live births", "30 per 1000 live births", "50 per 1000 live births", "100 per 1000 live births"],
            correct: 1,
            explanation:
              "The NPP 2000 set a goal of reducing the infant mortality rate to below 30 per 1,000 live births, among other objectives like free/compulsory education and universal immunisation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's comprehensive Family Planning Programme, aimed at promoting responsible and planned parenthood, was initiated by the Government of India in:",
            options: ["1947", "1952", "1972", "2000"],
            correct: 1,
            explanation:
              "The Government of India initiated a comprehensive Family Planning Programme in 1952, which eventually led to the National Population Policy (NPP) 2000.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "resources-and-development-india",
        name: "Resources and Development",
        questions: [
          q({
            text: "Resource planning is essential for a country like India mainly because:",
            options: [
              "All regions have identical resource endowments",
              "India has enormous regional diversity in the availability of resources",
              "India has no mineral resources at all",
              "Resource planning is only needed for import-dependent nations",
            ],
            correct: 1,
            explanation:
              "Resource planning is important in a country like India because there is enormous diversity in the availability of resources — some regions are rich in certain resources but deficient in others.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which state is described as rich in minerals and coal deposits, illustrating that resource-rich regions can still be economically backward?",
            options: ["Punjab", "Jharkhand", "Kerala", "Gujarat"],
            correct: 1,
            explanation:
              "Jharkhand, along with Chhattisgarh and Madhya Pradesh, is rich in minerals and coal deposits, yet these states are examples of resource-rich but economically backward regions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Arunachal Pradesh has an abundance of which resource, despite lacking infrastructural development?",
            options: ["Mineral deposits", "Water resources", "Solar energy", "Coal reserves"],
            correct: 1,
            explanation:
              "Arunachal Pradesh has an abundance of water resources but lacks infrastructural development.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Rajasthan is very well endowed with solar and wind energy but lacks:",
            options: ["Coal", "Water resources", "Iron ore", "Forest cover"],
            correct: 1,
            explanation:
              "The state of Rajasthan is very well endowed with solar and wind energy but lacks water resources.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Resource planning in India involves identification and inventory of resources, evolving an appropriate planning structure with technology and institutions, and:",
            options: [
              "Banning the private ownership of resources",
              "Matching resource development plans with overall national development plans",
              "Exporting all surplus resources immediately",
              "Nationalising all industries",
            ],
            correct: 1,
            explanation:
              "Resource planning is a complex process involving identification/inventory, evolving a planning structure with technology and institutions, and matching resource development plans with overall national development plans.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Five Year Plan placed 'land reform' as its main focus after Independence, given that resource planning in India has been pursued since then?",
            options: ["Second", "First", "Third", "Fifth"],
            correct: 1,
            explanation:
              "'Land reform' was the main focus of India's First Five Year Plan, as part of concerted efforts for resource planning since Independence.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which international report, published in 1987, introduced the concept of 'Sustainable Development' and was later published as the book 'Our Common Future'?",
            options: ["Agenda 21", "The Brundtland Commission Report", "The Club of Rome Report", "The Kyoto Protocol"],
            correct: 1,
            explanation:
              "The Brundtland Commission Report (1987) introduced the concept of 'Sustainable Development' and was published in the book 'Our Common Future'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Rio de Janeiro Earth Summit of 1992 led to the adoption of which declaration for achieving sustainable development in the 21st century?",
            options: ["Kyoto Protocol", "Agenda 21", "Paris Agreement", "Montreal Protocol"],
            correct: 1,
            explanation:
              "At the 1992 Rio Earth Summit, world leaders endorsed the global Forest Principles and adopted Agenda 21 for achieving sustainable development in the 21st century.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the chapter, what percentage of India's total land area is classified as plains?",
            options: ["27%", "30%", "43%", "54%"],
            correct: 2,
            explanation:
              "About 43 per cent of India's land area is plain, which provides facilities for agriculture and industry.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mountains account for about what percentage of India's total surface area, ensuring perennial flow of rivers and providing facilities for tourism?",
            options: ["20%", "30%", "43%", "50%"],
            correct: 1,
            explanation:
              "Mountains account for 30 per cent of India's total surface area, ensuring perennial flow of rivers and providing facilities for tourism and ecological aspects.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The physical extent of land on which crops are sown and harvested is known as:",
            options: ["Gross cropped area", "Net sown area", "Fallow land", "Culturable waste"],
            correct: 1,
            explanation:
              "Net sown area is the physical extent of land on which crops are sown and harvested; area sown more than once plus net sown area equals gross cropped area.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Land left uncultivated for more than five agricultural years is classified as:",
            options: ["Current fallow", "Other fallow", "Culturable waste land", "Net sown area"],
            correct: 2,
            explanation:
              "Culturable waste land is land left uncultivated for more than five agricultural years, unlike current fallow (≤1 year) and other fallow (1-5 years).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The National Forest Policy of 1952 set a desired target of forest cover at what percentage of the geographical area?",
            options: ["20%", "25%", "33%", "50%"],
            correct: 2,
            explanation:
              "The National Forest Policy (1952) outlined a desired target of 33 per cent of geographical area under forest, considered essential for maintaining ecological balance.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In which of the following states is over-irrigation identified as a major cause of land degradation, leading to waterlogging and increased salinity/alkalinity?",
            options: [
              "Gujarat and Rajasthan",
              "Punjab, Haryana and western Uttar Pradesh",
              "Jharkhand and Odisha",
              "Kerala and Tamil Nadu",
            ],
            correct: 1,
            explanation:
              "In Punjab, Haryana and western Uttar Pradesh, over-irrigation is responsible for land degradation due to waterlogging, increasing salinity and alkalinity in the soil.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In states like Jharkhand, Chhattisgarh, Madhya Pradesh and Odisha, which activity is identified as a major cause of land degradation due to associated deforestation?",
            options: ["Overgrazing", "Mining", "Over-irrigation", "Urbanisation"],
            correct: 1,
            explanation:
              "Deforestation due to mining has caused severe land degradation in states like Jharkhand, Chhattisgarh, Madhya Pradesh and Odisha.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The entire northern plains of India are made up of which type of soil, deposited by the Indus, Ganga and Brahmaputra river systems?",
            options: ["Black soil", "Alluvial soil", "Laterite soil", "Arid soil"],
            correct: 1,
            explanation:
              "The entire northern plains are made of alluvial soil, deposited by the Indus, Ganga and Brahmaputra river systems.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Older alluvial soil, with higher concentration of kankar nodules, is known as:",
            options: ["Khadar", "Bangar", "Regur", "Terai"],
            correct: 1,
            explanation:
              "Bangar is old alluvial soil with a higher concentration of kankar nodules, as distinct from Khadar (new alluvium), which is more fertile.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Newer alluvial soil, found closer to river floodplains with finer particles and greater fertility, is known as:",
            options: ["Bangar", "Khadar", "Bhabar", "Terai"],
            correct: 1,
            explanation:
              "Khadar is new alluvial soil, with finer particles and higher fertility than the older Bangar soil.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Black soil, ideal for growing cotton and also known as regur soil, is typical of which geological region?",
            options: [
              "The Aravalli hill system",
              "The Deccan trap (basalt) region",
              "The Gangetic alluvial plains",
              "The Himalayan foothills",
            ],
            correct: 1,
            explanation:
              "Black soil, also called black cotton soil or regur soil, is typical of the Deccan trap (basalt) region spread over the northwest Deccan plateau.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Black soils are rich in soil nutrients such as calcium carbonate, magnesium, potash and lime, but are generally poor in:",
            options: ["Moisture retention capacity", "Phosphoric content", "Clay content", "Cracking ability"],
            correct: 1,
            explanation:
              "Black soils are generally poor in phosphoric content, though rich in calcium carbonate, magnesium, potash and lime, and known for their high moisture-retention capacity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Red soil develops on crystalline igneous rocks in areas of low rainfall, getting its colour due to the diffusion of which element?",
            options: ["Aluminium", "Iron", "Calcium", "Magnesium"],
            correct: 1,
            explanation:
              "Red soil develops a reddish colour due to the diffusion of iron in crystalline and metamorphic rocks; it looks yellow when it occurs in a hydrated form.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The word 'Laterite' is derived from the Latin word 'later', meaning:",
            options: ["Red", "Brick", "Clay", "Rock"],
            correct: 1,
            explanation:
              "Laterite has been derived from the Latin word 'later', which means brick.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Laterite soil, formed through intense leaching in tropical/subtropical climates with alternating wet and dry seasons, is particularly suitable (after conservation techniques) for growing which crops in Karnataka, Kerala and Tamil Nadu?",
            options: ["Wheat and mustard", "Tea and coffee", "Cotton and jute", "Rice and sugarcane"],
            correct: 1,
            explanation:
              "After adopting appropriate soil conservation techniques, laterite soil in the hilly areas of Karnataka, Kerala and Tamil Nadu is very useful for growing tea and coffee.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Arid soils, found in western Rajasthan, are generally sandy and saline, with a lower horizon occupied by which material that restricts water infiltration?",
            options: ["Humus layer", "Kankar layer", "Bhabar layer", "Regur layer"],
            correct: 1,
            explanation:
              "The lower horizons of arid soils are occupied by kankar because of increasing calcium content downwards, and this kankar layer restricts the infiltration of water.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Chambal basin, deep gullies formed by soil erosion, rendering the land unfit for cultivation, are locally known as:",
            options: ["Duns", "Ravines", "Bhangar", "Khadins"],
            correct: 1,
            explanation:
              "Such gully-eroded, cultivation-unfit 'bad lands' in the Chambal basin are locally called ravines.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Ploughing along the contour lines of a slope to decelerate the flow of water down the slope is called:",
            options: ["Strip cropping", "Contour ploughing", "Terrace cultivation", "Shelter belt planting"],
            correct: 1,
            explanation:
              "Contour ploughing is ploughing along the contour lines of a hill slope, which decelerates the flow of water down the slope.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Planting rows of trees to break the force of the wind and stabilise sand dunes in western India is known as:",
            options: ["Contour ploughing", "Strip cropping", "Shelter belts", "Terrace farming"],
            correct: 2,
            explanation:
              "Rows of trees planted to create shelter and check wind movement are called shelter belts, which have significantly contributed to stabilising sand dunes and the desert in western India.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "forest-and-wildlife-resources-india",
        name: "Forest and Wildlife Resources",
        questions: [
          q({
            text: "Nokrek, a UNESCO-designated biosphere reserve known for its wild relatives of citrus fruits, is located in which state?",
            options: ["Meghalaya", "Assam", "Manipur", "Arunachal Pradesh"],
            correct: 0,
            explanation: "The Nokrek Biosphere Reserve, located in the Garo Hills of Meghalaya, is notable for its citrus gene sanctuary conserving wild relatives of citrus species.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following National Park-State pairs is correctly matched?",
            options: [
              "Kanha National Park - Madhya Pradesh",
              "Silent Valley National Park - Karnataka",
              "Bandhavgarh National Park - Rajasthan",
              "Gir National Park - Maharashtra",
            ],
            correct: 0,
            explanation: "Kanha National Park is correctly located in Madhya Pradesh. Silent Valley National Park is actually in Kerala (not Karnataka), Bandhavgarh National Park is in Madhya Pradesh (not Rajasthan), and Gir National Park is in Gujarat (not Maharashtra).",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Indian Wildlife (Protection) Act, which provided various provisions for protecting habitats and banning hunting, was implemented in:",
            options: ["1952", "1972", "1985", "1991"],
            correct: 1,
            explanation:
              "The Indian Wildlife (Protection) Act was implemented in 1972, with various provisions for protecting habitats.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "'Project Tiger', one of the most well-publicised wildlife conservation campaigns in the world, was launched in:",
            options: ["1969", "1973", "1980", "1991"],
            correct: 1,
            explanation:
              "Project Tiger was launched in 1973 in response to the dwindling tiger population.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "By 1973, the tiger population in India had dwindled to 1,827 from an estimated figure at the turn of the century of about:",
            options: ["10,000", "25,000", "40,000", "55,000"],
            correct: 3,
            explanation:
              "In 1973, authorities realised the tiger population had dwindled to 1,827 from an estimated 55,000 at the turn of the century.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India and Nepal together provide habitat to about what fraction of the world's surviving tiger population?",
            options: ["One-third", "Half", "Two-thirds", "Almost all"],
            correct: 2,
            explanation:
              "India and Nepal provide habitat to about two-thirds of the surviving tiger population in the world, making them prime targets for poaching and illegal trade.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT one of the tiger reserves mentioned in the chapter?",
            options: [
              "Corbett National Park (Uttarakhand)",
              "Sariska Wildlife Sanctuary (Rajasthan)",
              "Gir National Park (Gujarat)",
              "Periyar Tiger Reserve (Kerala)",
            ],
            correct: 2,
            explanation:
              "The chapter lists Corbett, Sunderbans, Bandhavgarh, Sariska, Manas and Periyar as tiger reserves — Gir is the habitat of the Asiatic lion, not a tiger reserve mentioned here.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "More than half of India's total forest land has been declared as:",
            options: ["Protected forests", "Reserved forests", "Unclassed forests", "National parks"],
            correct: 1,
            explanation:
              "More than half of the total forest land has been declared reserved forests, regarded as the most valuable for conservation of forest and wildlife resources.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which category of forest, as declared by the Forest Department, constitutes almost one-third of the total forest area and is protected from further depletion?",
            options: ["Reserved forests", "Protected forests", "Unclassed forests", "Biosphere reserves"],
            correct: 1,
            explanation:
              "Protected forests, almost one-third of the total forest area, are protected from any further depletion.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Other forests and wastelands belonging to both the government and private individuals/communities, common in the North-eastern states, are classified as:",
            options: ["Reserved forests", "Protected forests", "Unclassed forests", "Permanent forest estates"],
            correct: 2,
            explanation:
              "Unclassed forests are other forests and wastelands belonging to both government and private individuals and communities; most North-eastern states have a high percentage of these.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which state has the largest area under permanent forests, constituting 75 per cent of its total forest area?",
            options: ["Uttarakhand", "Madhya Pradesh", "Kerala", "Rajasthan"],
            correct: 1,
            explanation:
              "Madhya Pradesh has the largest area under permanent forests, constituting 75 per cent of its total forest area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Sariska Tiger Reserve, Rajasthan, local villagers fought against which activity by citing the Wildlife Protection Act?",
            options: ["Deforestation for agriculture", "Mining", "Poaching of deer", "Tourism development"],
            correct: 1,
            explanation:
              "In Sariska Tiger Reserve, Rajasthan, villagers have fought against mining by citing the Wildlife Protection Act.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The inhabitants of five villages in the Alwar district of Rajasthan declared 1,200 hectares of forest as the:",
            options: ["Chipko Reserve", "Bhairodev Dakav 'Sonchuri'", "Beej Bachao Zone", "Navdanya Sanctuary"],
            correct: 1,
            explanation:
              "Five villages in the Alwar district of Rajasthan declared 1,200 hectares of forest as the Bhairodev Dakav 'Sonchuri', enforcing their own rules against hunting.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The famous Chipko Movement, which successfully resisted deforestation in the Himalayas, is an example of:",
            options: ["Government-led afforestation", "Community-based conservation", "Judicial intervention", "Corporate social responsibility"],
            correct: 1,
            explanation:
              "The Chipko Movement is a community-based conservation effort that resisted deforestation and showed the success of community afforestation with indigenous species.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Beej Bachao Andolan (in Tehri) and Navdanya are examples of citizen/farmer groups that have shown the viability of:",
            options: [
              "Large-scale commercial monoculture",
              "Diversified crop production without synthetic chemicals",
              "Complete abandonment of traditional farming",
              "Export-oriented plantation agriculture",
            ],
            correct: 1,
            explanation:
              "Beej Bachao Andolan and Navdanya have shown that adequate levels of diversified crop production without synthetic chemicals are possible and economically viable.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Joint Forest Management (JFM) programme, which involves local communities in restoring degraded forests, has been in formal existence since 1988, when which state passed the first resolution for it?",
            options: ["Madhya Pradesh", "Odisha", "Rajasthan", "Kerala"],
            correct: 1,
            explanation:
              "JFM has been in formal existence since 1988, when the state of Odisha passed the first resolution for joint forest management.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under JFM, in return for protecting degraded forest land, members of local communities are entitled to intermediary benefits such as:",
            options: [
              "Full ownership of the forest land",
              "Non-timber forest produce and a share in harvested timber",
              "Exemption from all taxes",
              "Government jobs in the Forest Department",
            ],
            correct: 1,
            explanation:
              "Under JFM, community members are entitled to intermediary benefits like non-timber forest produce and a share in the timber harvested through 'successful protection'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Virgin forests preserved in pristine form due to age-old tribal beliefs that all creations of nature must be protected are known as:",
            options: ["Reserved forests", "Sacred Groves", "Biosphere reserves", "National parks"],
            correct: 1,
            explanation:
              "Sacred Groves — 'forests of God and Goddesses' — are patches of forest left untouched by local people due to age-old nature-worship beliefs.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Mundas and the Santhal tribes of the Chota Nagpur region traditionally worship which trees?",
            options: ["Peepal and banyan", "Mahua and kadamba", "Tamarind and mango", "Sal and teak"],
            correct: 1,
            explanation:
              "The Mundas and Santhal of Chota Nagpur region worship the mahua (Bassia latifolia) and kadamba (Anthocephalus cadamba) trees.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In and around Bishnoi villages in Rajasthan, which animals are protected as an integral part of the community, with nobody harming them?",
            options: ["Tigers and leopards", "Blackbuck, nilgai and peacocks", "Elephants and rhinos", "Wild boars and jackals"],
            correct: 1,
            explanation:
              "In and around Bishnoi villages in Rajasthan, herds of blackbuck (chinkara), nilgai and peacocks are protected as an integral part of the community.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the notifications under the Wildlife Act of 1980 and 1986, conservation planning was expanded to include several hundred species of butterflies, moths, beetles and:",
            options: ["A species of spider", "One dragonfly", "A species of snail", "A species of earthworm"],
            correct: 1,
            explanation:
              "The Wildlife Act notifications of 1980 and 1986 added several hundred butterflies, moths, beetles and one dragonfly to the list of protected species.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In 1991, for the first time, which category of organisms was added to India's protected species list, starting with six species?",
            options: ["Fungi", "Plants", "Bacteria", "Algae"],
            correct: 1,
            explanation:
              "In 1991, for the first time, plants were also added to the protected species list, starting with six species.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "water-resources-india",
        name: "Water Resources",
        questions: [
          q({
            text: "By 2025, it is predicted that nearly how many people worldwide will live in absolute water scarcity?",
            options: ["500 million", "1 billion", "2 billion", "5 billion"],
            correct: 2,
            explanation:
              "The chapter notes it is predicted that by 2025, nearly two billion people will live in absolute water scarcity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Water scarcity is most often caused not by low rainfall alone, but by:",
            options: [
              "Excessive rainfall and flooding",
              "Over-exploitation, excessive use and unequal access to water",
              "The complete absence of groundwater",
              "Only industrial pollution",
            ],
            correct: 1,
            explanation:
              "Water scarcity in most cases is caused by over-exploitation, excessive use and unequal access to water among different social groups, not just low rainfall.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which sector is described as the largest consumer of water in India, due to the demand to expand irrigated areas for dry-season agriculture?",
            options: ["Domestic households", "Irrigated agriculture", "Industry", "Hydropower generation"],
            correct: 1,
            explanation:
              "Irrigated agriculture is the largest consumer of water, as water resources are over-exploited to expand irrigated areas for dry-season agriculture.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Atal Bhujal Yojana (Atal Jal) is being implemented in water-stressed Gram Panchayats across how many states?",
            options: ["3", "5", "7", "10"],
            correct: 2,
            explanation:
              "Atal Bhujal Yojana is implemented in 8,220 water-stressed Gram Panchayats across 229 blocks in 80 districts of seven states.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The goal of the Jal Jeevan Mission (JJM) is to enable every rural household to get assured piped water supply of how many litres per capita per day?",
            options: ["25 litres", "40 litres", "55 litres", "100 litres"],
            correct: 2,
            explanation:
              "The goal of JJM is to enable every rural household to get assured supply of potable piped water at a service level of 55 litres per capita per day.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the first century B.C., which place near Allahabad had a sophisticated water harvesting system channelling the flood water of the river Ganga?",
            options: ["Sringaverapura", "Nagarjunakonda", "Kalinga", "Bennur"],
            correct: 0,
            explanation:
              "Sringaverapura, near Allahabad, had a sophisticated water harvesting system channelling the flood water of the river Ganga in the first century B.C.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Hauz Khas water tank in Delhi, constructed to supply water to the Siri Fort area, was built in the 14th century by:",
            options: ["Ashoka", "Iltutmish", "Chandragupta Maurya", "Akbar"],
            correct: 1,
            explanation:
              "In the 14th century, the tank in Hauz Khas, Delhi, was constructed by Iltutmish for supplying water to the Siri Fort area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Jawaharlal Nehru famously referred to dams as the:",
            options: ["'Pillars of independence'", "'Temples of modern India'", "'Backbone of agriculture'", "'Symbols of colonial legacy'"],
            correct: 1,
            explanation:
              "Jawaharlal Nehru proudly proclaimed dams as the 'temples of modern India', integrating agricultural, village-economy and industrial development.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In the Sutluj-Beas river basin, the Bhakra-Nangal project's water is used for both irrigation and:",
            options: ["Fishing", "Hydel power production", "Tourism", "Salt production"],
            correct: 1,
            explanation:
              "In the Sutluj-Beas river basin, the Bhakra-Nangal project water is being used for both hydel power production and irrigation.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Hirakud project, which integrates water conservation with flood control, is located in which river basin?",
            options: ["The Narmada basin", "The Mahanadi basin", "The Godavari basin", "The Krishna basin"],
            correct: 1,
            explanation:
              "The Hirakud project in the Mahanadi basin integrates conservation of water with flood control.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Sardar Sarovar Dam, built over the Narmada river, covers parts of Gujarat, Maharashtra, Rajasthan and:",
            options: ["Karnataka", "Madhya Pradesh", "Andhra Pradesh", "Chhattisgarh"],
            correct: 1,
            explanation:
              "The Sardar Sarovar Dam over the Narmada River covers four states: Maharashtra, Madhya Pradesh, Gujarat and Rajasthan.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Sardar Sarovar Project aims to bring irrigation to drought-prone and desert areas, including specific districts in Rajasthan named in the chapter as:",
            options: ["Jaisalmer and Bikaner", "Barmer and Jalore", "Jodhpur and Nagaur", "Sikar and Churu"],
            correct: 1,
            explanation:
              "The Sardar Sarovar Project irrigates land in the strategic desert districts of Barmer and Jalore in Rajasthan.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "One criticism of large dams is that regulating and damming rivers cause poor sediment flow and excessive sedimentation, resulting in:",
            options: [
              "Improved habitats for aquatic life",
              "Rockier stream beds and poorer aquatic habitats",
              "Increased fish migration",
              "Reduced water pollution",
            ],
            correct: 1,
            explanation:
              "Damming rivers causes poor sediment flow and excessive sedimentation at the bottom of the reservoir, resulting in rockier stream beds and poorer habitats for aquatic life.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Krishna-Godavari water dispute mentioned in the chapter arises from objections by Karnataka and Andhra Pradesh regarding the diversion of water at Koyna by which state's government?",
            options: ["Tamil Nadu", "Maharashtra", "Telangana", "Odisha"],
            correct: 1,
            explanation:
              "The Krishna-Godavari dispute arises from objections by Karnataka and Andhra Pradesh to the Maharashtra government's diversion of more water at Koyna for a multipurpose project.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Ironically, dams constructed to control floods have sometimes triggered floods due to:",
            options: ["Excessive rainfall alone", "Sedimentation in the reservoir", "Lack of spillways", "Earthquakes only"],
            correct: 1,
            explanation:
              "Dams constructed to control floods have ironically triggered floods due to sedimentation in the reservoir, and have mostly been unsuccessful at controlling floods during excessive rainfall.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Pradhan Mantri Krishi Sinchaee Yojana includes the objectives of 'har khet ko pani' (water to every farm) and:",
            options: ["'Jal hi jeevan hai'", "'Per drop more crop'", "'Beti bachao, beti padhao'", "'Swachh Bharat, swasth Bharat'"],
            correct: 1,
            explanation:
              "The Pradhan Mantri Krishi Sinchaee Yojana aims for 'har khet ko pani' and 'per drop more crop', improving irrigation efficiency and water-saving technologies.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Diversion channels used in the Western Himalayas to divert water for agriculture are traditionally called:",
            options: ["Tankas", "Guls or kuls", "Khadins", "Johads"],
            correct: 1,
            explanation:
              "In hill and mountainous regions, people built diversion channels called 'guls' or 'kuls' of the Western Himalayas for agriculture.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In arid and semi-arid regions, agricultural fields converted into rain-fed storage structures that allow water to stand and moisten the soil are called 'khadins' in Jaisalmer and by which name elsewhere in Rajasthan?",
            options: ["Tankas", "Johads", "Guls", "Bhangar"],
            correct: 1,
            explanation:
              "These rain-fed storage structures are called 'khadins' in Jaisalmer and 'Johads' in other parts of Rajasthan.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Bikaner, Phalodi and Barmer, traditional underground tanks built inside houses to store rooftop-harvested rainwater for drinking are called:",
            options: ["Johads", "Tankas", "Khadins", "Guls"],
            correct: 1,
            explanation:
              "In the semi-arid and arid regions of Rajasthan, particularly Bikaner, Phalodi and Barmer, houses traditionally had underground tanks called 'tankas' for storing drinking water.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In western Rajasthan, rainwater collected in tankas, considered the purest form of natural water, is commonly referred to as:",
            options: ["Amrit jal", "Palar pani", "Ganga jal", "Shuddh pani"],
            correct: 1,
            explanation:
              "Rainwater stored in tankas, considered the purest form of natural water in this region, is commonly referred to as 'palar pani'.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Despite being located just 55 km from Cherrapunji and Mawsynram, which receive the highest rainfall in the world, which city faces acute water shortage and relies heavily on rooftop rainwater harvesting?",
            options: ["Guwahati", "Shillong", "Imphal", "Agartala"],
            correct: 1,
            explanation:
              "Shillong, Meghalaya, faces acute water shortage despite being just 55 km from Cherrapunji and Mawsynram, and relies heavily on rooftop rainwater harvesting.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Shillong, rooftop rainwater harvesting is estimated to meet what percentage of the total household water requirement?",
            options: ["5-10%", "15-25%", "40-50%", "60-75%"],
            correct: 1,
            explanation:
              "Nearly 15-25 per cent of the total water requirement of households in Shillong comes from rooftop rainwater harvesting.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Gendathur, a village in Mysuru, Karnataka, villagers installed rooftop rainwater harvesting systems in nearly how many households?",
            options: ["50", "100", "200", "500"],
            correct: 2,
            explanation:
              "In Gendathur, nearly 200 households have installed rooftop rainwater harvesting systems to meet their water needs.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The 200-year-old system of tapping stream and spring water using bamboo pipes to irrigate plants is a traditional practice found in:",
            options: ["Rajasthan", "Meghalaya", "Gujarat", "Tamil Nadu"],
            correct: 1,
            explanation:
              "The bamboo drip irrigation system, a 200-year-old technique of tapping stream and spring water using bamboo pipes, is prevalent in Meghalaya.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which state was the first in India to make rooftop rainwater harvesting structures compulsory for all houses, with legal provisions to punish defaulters?",
            options: ["Karnataka", "Kerala", "Tamil Nadu", "Maharashtra"],
            correct: 2,
            explanation:
              "Tamil Nadu is the first state in India to make rooftop rainwater harvesting structures compulsory for all houses, with legal provisions to punish defaulters.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "agriculture-of-india",
        name: "Agriculture",
        questions: [
          q({
            text: "Which of the following is NOT a typical characteristic of maize cultivation in India?",
            options: [
              "It is highly sensitive to excess water and waterlogging",
              "It is grown as a Kharif crop in most parts of the country",
              "It requires temperatures between 21°C and 27°C for growth",
              "It is used both as food and as fodder",
            ],
            correct: 0,
            explanation: "Maize actually requires well-drained soil and is sensitive to waterlogging, but it is not generally described as being tolerant of excess water — this statement, framed as a common feature, is the false one among otherwise accurate statements about maize cultivation in India (Kharif season, ideal temperature range, and dual use as food and fodder).",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Sugarcane, a tropical as well as sub-tropical crop, is NOT typically grown in which of the following states?",
            options: ["Himachal Pradesh", "Uttar Pradesh", "Maharashtra", "Tamil Nadu"],
            correct: 0,
            explanation: "Sugarcane requires a hot and humid climate and is grown mainly in Uttar Pradesh, Maharashtra, Karnataka and Tamil Nadu; the hilly, temperate terrain of Himachal Pradesh is unsuited to its cultivation.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "'Truck farming', a form of commercial farming practised near urban centres to supply fresh produce quickly, is mainly associated with the cultivation of:",
            options: ["Vegetables", "Fibre crops", "Plantation crops", "Oilseeds"],
            correct: 0,
            explanation: "Truck farming refers to the commercial cultivation of vegetables near urban markets, allowing perishable produce to be transported quickly ('trucked') to consumers.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Bajra, a coarse cereal grown mainly in the dry, sandy regions of Rajasthan, Gujarat and Haryana, is cultivated as a:",
            options: ["Kharif crop", "Rabi crop", "Zaid crop", "Plantation crop"],
            correct: 0,
            explanation: "Bajra (pearl millet) is a drought-resistant Kharif crop, sown with the onset of the monsoon and harvested in autumn.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Approximately what fraction of India's population is engaged in agricultural activities, according to the chapter?",
            options: ["One-third", "Half", "Two-thirds", "Nine-tenths"],
            correct: 2,
            explanation:
              "India is an agriculturally important country, with two-thirds of its population engaged in agricultural activities.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Primitive subsistence farming, practised on small patches of land with primitive tools and family/community labour, is also known as:",
            options: ["Intensive farming", "'Slash and burn' agriculture", "Plantation farming", "Commercial farming"],
            correct: 1,
            explanation:
              "Primitive subsistence farming is a 'slash and burn' agriculture where farmers clear a patch of land, cultivate it, and move on once fertility decreases.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "'Jhumming', a form of primitive subsistence (shifting cultivation) farming, is practised in the north-eastern states such as Assam, Meghalaya, Mizoram and:",
            options: ["Sikkim", "Nagaland", "Tripura", "Manipur"],
            correct: 1,
            explanation:
              "Jhumming is practised in north-eastern states like Assam, Meghalaya, Mizoram and Nagaland.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Shifting cultivation is known as 'Pamlou' in Manipur and 'Dipa' in which district of Chhattisgarh?",
            options: ["Raipur", "Bastar", "Durg", "Bilaspur"],
            correct: 1,
            explanation:
              "Shifting cultivation is called 'Pamlou' in Manipur and 'Dipa' in the Bastar district of Chhattisgarh.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The 'slash and burn' agriculture, known as 'Jhumming' in India, is called 'Milpa' in Mexico and Central America, and 'Roca' in:",
            options: ["Indonesia", "Brazil", "Vietnam", "Venezuela"],
            correct: 1,
            explanation:
              "Shifting cultivation is called 'Milpa' in Mexico/Central America and 'Roca' in Brazil, among other regional names worldwide.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Intensive subsistence farming, practised in areas of high population pressure on land, is characterised by:",
            options: [
              "Low labour input and vast land holdings",
              "Labour-intensive farming with high doses of biochemical inputs and irrigation",
              "Complete dependence on nomadic herding",
              "Cultivation of a single crop over huge estates",
            ],
            correct: 1,
            explanation:
              "Intensive subsistence farming is labour-intensive, practised in areas of high population pressure, using high doses of biochemical inputs and irrigation for higher production.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The main characteristic of commercial farming in India is the use of higher doses of modern inputs such as HYV seeds, chemical fertilisers and pesticides. Rice, for example, is a commercial crop in Punjab and Haryana, but in which state is it grown mainly as a subsistence crop?",
            options: ["Odisha", "Andhra Pradesh", "Tamil Nadu", "Kerala"],
            correct: 0,
            explanation:
              "Rice is a commercial crop in Haryana and Punjab, but in Odisha, it is grown mainly as a subsistence crop, showing that commercialisation varies regionally.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Plantation farming, an interface of agriculture and industry, involves growing a single crop over a large area using capital-intensive inputs and:",
            options: ["Only family labour", "Migrant labourers", "No labour at all", "Only mechanised harvesting"],
            correct: 1,
            explanation:
              "Plantations cover large tracts of land, using capital-intensive inputs with the help of migrant labourers.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tea plantations in Assam and coffee plantations in which state are given as important examples of plantation crops in India?",
            options: ["Kerala", "Karnataka", "Tamil Nadu", "Andhra Pradesh"],
            correct: 1,
            explanation:
              "Tea in Assam and North Bengal, and coffee in Karnataka, are given as important plantation crops in the chapter.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "India has three cropping seasons: kharif, zaid and:",
            options: ["Monsoon", "Rabi", "Summer", "Winter"],
            correct: 1,
            explanation:
              "India has three cropping seasons — rabi, kharif and zaid.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Rabi crops are sown in winter from October to December and harvested in summer from:",
            options: ["January to March", "April to June", "July to September", "November to December"],
            correct: 1,
            explanation:
              "Rabi crops are sown in winter from October to December and harvested in summer from April to June.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is NOT a rabi crop mentioned in the chapter?",
            options: ["Wheat", "Mustard", "Gram", "Paddy"],
            correct: 3,
            explanation:
              "Important rabi crops include wheat, barley, peas, gram and mustard — paddy is primarily a kharif crop.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The success of rabi crops in north-western India (Punjab, Haryana, HP, J&K, Uttarakhand, UP) is helped by winter precipitation from:",
            options: ["The southwest monsoon", "Western temperate cyclones", "The northeast monsoon", "Local convectional rainfall"],
            correct: 1,
            explanation:
              "The availability of precipitation during winter months, due to western temperate cyclones, helps the success of rabi crops in north-western India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Kharif crops are sown with the onset of the monsoon and harvested in:",
            options: ["December-January", "March-April", "September-October", "June-July"],
            correct: 2,
            explanation:
              "Kharif crops are grown with the onset of the monsoon and are harvested in September-October.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In Assam, West Bengal and Odisha, three crops of paddy are grown in a year, known as:",
            options: [
              "Kharif, Rabi and Zaid",
              "Aus, Aman and Boro",
              "Khadar, Bhangar and Terai",
              "Jhum, Bewar and Podu",
            ],
            correct: 1,
            explanation:
              "In states like Assam, West Bengal and Odisha, three crops of paddy are grown in a year — these are Aus, Aman and Boro.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The short cropping season between the rabi and kharif seasons, during the summer months, is known as:",
            options: ["Zaid", "Monsoon", "Winter", "Aman"],
            correct: 0,
            explanation:
              "The Zaid season is the short cropping season during summer months, between the rabi and kharif seasons, growing crops like watermelon, muskmelon and vegetables.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Rice, the staple food crop of most Indians, requires high temperature (above 25°C), high humidity and annual rainfall above:",
            options: ["50 cm", "75 cm", "100 cm", "150 cm"],
            correct: 2,
            explanation:
              "Rice is a kharif crop which requires high temperature (above 25°C) and high humidity with annual rainfall above 100 cm.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India is the second largest producer of rice in the world after:",
            options: ["Bangladesh", "China", "Indonesia", "Vietnam"],
            correct: 1,
            explanation:
              "India is the second largest producer of rice in the world, after China.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Wheat, the second most important cereal crop, requires a cool growing season with bright sunshine at the time of ripening, and grows in two main zones — the Ganga-Satluj plains in the northwest, and:",
            options: [
              "The black soil region of the Deccan",
              "The alluvial plains of Assam",
              "The coastal plains of Tamil Nadu",
              "The Thar desert region",
            ],
            correct: 0,
            explanation:
              "The two important wheat-growing zones are the Ganga-Satluj plains in the north-west, and the black soil region of the Deccan.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Among the millets, which crop is described as very rich in iron, calcium, other micronutrients and roughage?",
            options: ["Jowar", "Bajra", "Ragi", "Maize"],
            correct: 2,
            explanation:
              "Ragi, among the millets, is described as being very rich in iron, calcium, other micro nutrients and roughage.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Jowar, the third most important food crop by area and production, is mostly a rain-fed crop grown in states like Maharashtra, Karnataka, Andhra Pradesh and:",
            options: ["Madhya Pradesh", "Punjab", "Kerala", "Assam"],
            correct: 0,
            explanation:
              "Jowar is a rain-fed crop mainly grown in Maharashtra, Karnataka, Andhra Pradesh and Madhya Pradesh.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India is the largest producer as well as consumer of which crop, which is also the major source of protein in a vegetarian diet?",
            options: ["Oilseeds", "Pulses", "Millets", "Sugarcane"],
            correct: 1,
            explanation:
              "India is the largest producer as well as consumer of pulses, the major source of protein in a vegetarian diet.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Being leguminous crops, most pulses help restore soil fertility by fixing which element from the air (with the exception of arhar)?",
            options: ["Carbon", "Nitrogen", "Phosphorus", "Potassium"],
            correct: 1,
            explanation:
              "Being leguminous crops, most pulses (except arhar) help restore soil fertility by fixing nitrogen from the air, hence grown in rotation with other crops.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India is the second largest producer of sugarcane in the world, after:",
            options: ["China", "Brazil", "Thailand", "Cuba"],
            correct: 1,
            explanation:
              "India is the second largest producer of sugarcane in the world, only after Brazil.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In 2018, India was the second largest producer of groundnut in the world after China, with which state being the largest domestic producer, followed by Rajasthan and Tamil Nadu?",
            options: ["Andhra Pradesh", "Gujarat", "Maharashtra", "Karnataka"],
            correct: 1,
            explanation:
              "In 2019-20, Gujarat was the largest producer of groundnut, followed by Rajasthan and Tamil Nadu.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Arabica variety of coffee, initially brought from Yemen, was first introduced for cultivation in India on the:",
            options: ["Nilgiri Hills", "Baba Budan Hills", "Western Ghats near Wayanad", "Shevaroy Hills"],
            correct: 1,
            explanation:
              "The Arabica variety of coffee, brought from Yemen, was initially introduced on the Baba Budan Hills; its cultivation is now confined to the Nilgiri hills of Karnataka, Kerala and Tamil Nadu.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 2018, India was the second largest producer of fruits and vegetables in the world, after:",
            options: ["USA", "China", "Brazil", "Indonesia"],
            correct: 1,
            explanation:
              "In 2018, India was the second largest producer of fruits and vegetables in the world after China.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Cotton, believed to have originated in India, grows well in the black cotton soil of the Deccan plateau and requires about 210 frost-free days along with:",
            options: [
              "Heavy rainfall throughout the year",
              "High temperature and bright sunshine",
              "Cool temperate climate",
              "Waterlogged conditions",
            ],
            correct: 1,
            explanation:
              "Cotton requires high temperature, light rainfall or irrigation, 210 frost-free days and bright sunshine for its growth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Jute, known as the 'Golden Fibre', grows well on well-drained fertile soils in flood plains that are renewed every year, and is mainly produced in West Bengal, Bihar, Assam, Odisha and:",
            options: ["Meghalaya", "Punjab", "Gujarat", "Kerala"],
            correct: 0,
            explanation:
              "The major jute producing states are West Bengal, Bihar, Assam, Odisha and Meghalaya.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The rearing of silkworms for the production of silk fibre, fed on green leaves (especially mulberry), is known as:",
            options: ["Viticulture", "Sericulture", "Horticulture", "Pisciculture"],
            correct: 1,
            explanation:
              "Rearing of silk worms for the production of silk fibre is known as sericulture.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The 1960s-70s agricultural reforms in India included the Green Revolution (based on package technology) and the White Revolution, also known as:",
            options: ["Operation Flood", "Operation Barga", "Operation Blackboard", "Mission Indradhanush"],
            correct: 0,
            explanation:
              "The White Revolution is also known as Operation Flood, initiated alongside the Green Revolution to improve Indian agriculture in the 1960s and 1970s.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Bhoodan-Gramdan movement, initiated by Vinoba Bhave and also called the 'Bloodless Revolution', began when a landowner offered 80 acres of land to be distributed among 80 landless villagers at:",
            options: ["Wardha", "Pochampalli", "Sevagram", "Ahmedabad"],
            correct: 1,
            explanation:
              "At Pochampalli in Andhra Pradesh, Shri Ram Chandra Reddy offered 80 acres of land to 80 landless villagers, an act known as 'Bhoodan', which began the Bhoodan-Gramdan movement.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Kissan Credit Card (KCC) and Personal Accident Insurance Scheme (PAIS) are government schemes introduced for the benefit of:",
            options: ["Industrial workers", "Farmers", "Fishermen only", "Urban entrepreneurs"],
            correct: 1,
            explanation:
              "Kissan Credit Card and Personal Accident Insurance Scheme are among the schemes introduced by the Government of India for the benefit of farmers.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "minerals-and-energy-resources-india",
        name: "Minerals and Energy Resources",
        questions: [
          q({
            text: "Geologists define a mineral as a homogenous, naturally occurring substance with:",
            options: ["A high market value", "A definable internal structure", "No chemical composition", "Only metallic properties"],
            correct: 1,
            explanation:
              "Geologists define a mineral as a 'homogenous, naturally occurring substance with a definable internal structure'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The term used to describe an accumulation of any mineral mixed with other elements, in sufficient concentration for commercially viable extraction, is:",
            options: ["A lode", "An ore", "A vein", "A placer"],
            correct: 1,
            explanation:
              "'Ore' is the term used to describe an accumulation of any mineral mixed with other elements, where the mineral content must be sufficiently concentrated to make extraction commercially viable.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In igneous and metamorphic rocks, minerals occurring in smaller cracks/crevices are called veins, while the larger occurrences are called:",
            options: ["Lodes", "Beds", "Strata", "Placers"],
            correct: 0,
            explanation:
              "In igneous and metamorphic rocks, smaller mineral occurrences are called veins, and larger ones are called lodes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tin, copper, zinc and lead are typically obtained from mineral occurrences in the form of:",
            options: ["Beds and layers", "Veins and lodes", "Placer deposits", "Ocean-derived salts"],
            correct: 1,
            explanation:
              "Major metallic minerals like tin, copper, zinc and lead are obtained from veins and lodes in igneous and metamorphic rocks.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Coal and some forms of iron ore, concentrated as a result of long periods under great heat and pressure, are typically found in:",
            options: ["Igneous rocks", "Sedimentary rocks (in beds or layers)", "Placer deposits", "Ocean beds"],
            correct: 1,
            explanation:
              "In sedimentary rocks, minerals occur in beds or layers; coal and some iron ore have been concentrated this way under long periods of heat and pressure.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Gypsum, potash salt and sodium salt are sedimentary minerals formed mainly as a result of:",
            options: ["Evaporation, especially in arid regions", "Volcanic eruptions", "Glacial deposition", "Metamorphism under heat"],
            correct: 0,
            explanation:
              "Gypsum, potash salt and sodium salt are sedimentary minerals formed as a result of evaporation, especially in arid regions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Bauxite is formed through which process?",
            options: [
              "Deposition and accumulation in sedimentary strata",
              "Decomposition of surface rocks, leaving a residual mass of weathered material",
              "Crystallisation from molten magma",
              "Evaporation of seawater",
            ],
            correct: 1,
            explanation:
              "Bauxite is formed by the decomposition of surface rocks and the removal of soluble constituents, leaving a residual mass of weathered material.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Alluvial deposits of minerals found in sands of valley floors and the base of hills, generally containing minerals not corroded by water (such as gold, silver, tin and platinum), are called:",
            options: ["Veins", "Lodes", "Placer deposits", "Ore beds"],
            correct: 2,
            explanation:
              "Placer deposits are alluvial deposits in sands of valley floors and hill bases, containing minerals not corroded by water, such as gold, silver, tin and platinum.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Common salt, magnesium and bromine are largely derived from:",
            options: ["Igneous rock veins", "Ocean waters", "Placer deposits", "Sedimentary beds"],
            correct: 1,
            explanation:
              "Common salt, magnesium and bromine are largely derived from ocean waters, while ocean beds are rich in manganese nodules.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "'Rat-hole mining', a controversial and now-banned coal mining method involving long narrow tunnels, is practised in which state, where minerals are owned by individuals or communities rather than being nationalised?",
            options: ["Jharkhand", "Meghalaya", "Odisha", "Chhattisgarh"],
            correct: 1,
            explanation:
              "In Meghalaya, minerals are owned by individuals or communities, and coal mining in Jowai and Cherapunjee is done through a long narrow tunnel known as 'rat-hole' mining, now declared illegal by the National Green Tribunal.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Broadly speaking, most of India's reserves of coal, metallic minerals and mica are found in which type of rock region?",
            options: ["Alluvial plains of north India", "Peninsular rocks", "Coastal sedimentary basins", "Himalayan fold mountains"],
            correct: 1,
            explanation:
              "Broadly, peninsular rocks contain most of India's reserves of coal, metallic minerals, mica and many other non-metallic minerals.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Most of India's petroleum deposits are found in sedimentary rocks on the western and eastern flanks of the peninsula, particularly in Gujarat and:",
            options: ["Rajasthan", "Assam", "Kerala", "Odisha"],
            correct: 1,
            explanation:
              "Sedimentary rocks on the western and eastern flanks of the peninsula, in Gujarat and Assam, have most of the petroleum deposits.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Magnetite, described as the finest iron ore with excellent magnetic qualities, has an iron content of up to:",
            options: ["50%", "60%", "70%", "90%"],
            correct: 2,
            explanation:
              "Magnetite is the finest iron ore, with a very high iron content of up to 70 per cent and excellent magnetic qualities valuable in the electrical industry.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Hematite, the most important industrial iron ore in terms of quantity used, has a slightly lower iron content than magnetite, ranging between:",
            options: ["20-30%", "50-60%", "70-80%", "90-100%"],
            correct: 1,
            explanation:
              "Hematite ore, the most important industrial iron ore by quantity used, has an iron content between 50-60 per cent, slightly lower than magnetite.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 2018-19, almost the entire production (97%) of India's iron ore came from Odisha, Chhattisgarh, Karnataka and:",
            options: ["Jharkhand", "Maharashtra", "Rajasthan", "Goa"],
            correct: 0,
            explanation:
              "In 2018-19, almost the entire production (97%) of iron ore came from Odisha, Chhattisgarh, Karnataka and Jharkhand.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "High-grade hematite in the famous Bailadila range of hills, comprising 14 deposits of super high-grade ore, is located in the Bastar district of:",
            options: ["Odisha", "Jharkhand", "Chhattisgarh", "Karnataka"],
            correct: 2,
            explanation:
              "The Bailadila range of hills, with 14 deposits of super high-grade hematite iron ore, is located in the Bastar district of Chhattisgarh.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Iron ore from the Bailadila range is exported to Japan and South Korea via which port?",
            options: ["Marmagao", "Vishakhapatnam", "Mangaluru", "Paradwip"],
            correct: 1,
            explanation:
              "Iron ore from the Bailadila mines is exported to Japan and South Korea via Vishakhapatnam port.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Kudremukh mines, located in the Western Ghats of Karnataka and known as a 100 per cent export unit, transport ore as slurry through a pipeline to a port near:",
            options: ["Chennai", "Mangaluru", "Kochi", "Tuticorin"],
            correct: 1,
            explanation:
              "The Kudremukh ore is transported as slurry through a pipeline to a port near Mangaluru.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Iron ore from the Maharashtra-Goa belt is mainly exported through which port?",
            options: ["Kandla", "Marmagao", "Paradwip", "Haldia"],
            correct: 1,
            explanation:
              "Iron ore from the Maharashtra-Goa belt, which includes Goa and the Ratnagiri district, is exported through Marmagao port.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Approximately how much manganese is required to manufacture one tonne of steel?",
            options: ["1 kg", "5 kg", "10 kg", "50 kg"],
            correct: 2,
            explanation:
              "Nearly 10 kg of manganese is required to manufacture one tonne of steel.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to 2018-19 data cited in the chapter, which state was the largest producer of manganese in India?",
            options: ["Maharashtra", "Odisha", "Madhya Pradesh", "Karnataka"],
            correct: 2,
            explanation:
              "In 2018-19, Madhya Pradesh had the largest share (33%) of manganese production, followed by Maharashtra (27%) and Odisha (16%).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India is described as critically deficient in the reserve and production of which non-ferrous metal, mainly used in electrical cables and electronics?",
            options: ["Bauxite", "Copper", "Mica", "Limestone"],
            correct: 1,
            explanation:
              "India is critically deficient in the reserve and production of copper, which is malleable, ductile and a good conductor, used mainly in electrical cables and electronics.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Khetri mines, a leading producer of copper in India, are located in:",
            options: ["Madhya Pradesh", "Rajasthan", "Jharkhand", "Karnataka"],
            correct: 1,
            explanation:
              "The Khetri mines in Rajasthan, along with Balaghat mines (MP) and Singhbhum district (Jharkhand), are leading producers of copper.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's bauxite deposits, the raw material for aluminium, are mainly found in the Amarkantak plateau, Maikal hills and the plateau region of:",
            options: ["Koderma-Gaya-Hazaribagh", "Bilaspur-Katni", "Ballari-Chitradurga", "Durg-Bastar"],
            correct: 1,
            explanation:
              "India's bauxite deposits are mainly found in the Amarkantak plateau, Maikal hills and the plateau region of Bilaspur-Katni.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to 2016-17 data, which state was the largest bauxite producing state in India, with the important Panchpatmali deposits in its Koraput district?",
            options: ["Jharkhand", "Gujarat", "Odisha", "Chhattisgarh"],
            correct: 2,
            explanation:
              "Odisha was the largest bauxite producing state in India in 2016-17, with the Panchpatmali deposits in Koraput district being the most important.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mica, valued for its dielectric strength and insulating properties in the electrical and electronics industries, has its leading production area in the Koderma-Gaya-Hazaribagh belt of:",
            options: ["Rajasthan", "Jharkhand", "Andhra Pradesh", "Bihar"],
            correct: 1,
            explanation:
              "The Koderma-Gaya-Hazaribagh belt of Jharkhand is the leading producer of mica in India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Limestone, the basic raw material for the cement industry, is also essential for smelting iron ore in the:",
            options: ["Open-cast mine", "Blast furnace", "Rolling mill", "Coking oven"],
            correct: 1,
            explanation:
              "Limestone is the basic raw material for the cement industry and is also essential for smelting iron ore in the blast furnace.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Peat, formed from decaying plants in swamps, has low carbon content, high moisture content, and:",
            options: [
              "The highest heating capacity of all coal types",
              "A low heating capacity",
              "No moisture content",
              "The highest quality among all coal types",
            ],
            correct: 1,
            explanation:
              "Peat, produced from decaying plants in swamps, has low carbon and high moisture content, giving it a low heating capacity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Lignite, a low-grade brown coal with high moisture content used for electricity generation, has its principal reserves at Neyveli in:",
            options: ["Andhra Pradesh", "Tamil Nadu", "Karnataka", "Kerala"],
            correct: 1,
            explanation:
              "The principal lignite reserves are in Neyveli in Tamil Nadu, and are used for electricity generation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Bituminous coal that has special value for smelting iron in blast furnaces is known as:",
            options: ["Peat", "Metallurgical coal", "Anthracite", "Lignite"],
            correct: 1,
            explanation:
              "Metallurgical coal is high-grade bituminous coal with special value for smelting iron in blast furnaces.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Anthracite is described in the chapter as:",
            options: ["The lowest quality coal", "The highest quality hard coal", "A type of lignite", "A form of peat"],
            correct: 1,
            explanation:
              "Anthracite is the highest quality hard coal, as described in the chapter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Gondwana coal deposits, over 200 million years old and mostly metallurgical coal, are chiefly located in the Damodar valley (West Bengal-Jharkhand), including the coalfields of Jharia, Bokaro and:",
            options: ["Neyveli", "Raniganj", "Singareni", "Talcher"],
            correct: 1,
            explanation:
              "Jharia, Raniganj and Bokaro are important Gondwana-age coalfields in the Damodar valley (West Bengal-Jharkhand).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tertiary coal deposits, only about 55 million years old, occur in the north-eastern states of Meghalaya, Assam, Nagaland and:",
            options: ["Manipur", "Mizoram", "Arunachal Pradesh", "Tripura"],
            correct: 2,
            explanation:
              "Tertiary coals occur in the north-eastern states of Meghalaya, Assam, Arunachal Pradesh and Nagaland.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Petroleum refineries are often described as a 'nodal industry' because they supply raw material to synthetic textile, fertiliser and numerous other:",
            options: ["Agricultural industries", "Chemical industries", "Mining industries", "Textile-weaving industries only"],
            correct: 1,
            explanation:
              "Petroleum refineries act as a 'nodal industry' for synthetic textile, fertiliser and numerous other chemical industries.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Most petroleum occurrences in India are associated with anticlines and fault traps in rock formations of which geological age?",
            options: ["Gondwana age", "Tertiary age", "Precambrian age", "Jurassic age"],
            correct: 1,
            explanation:
              "Most petroleum occurrences in India are associated with anticlines and fault traps in the rock formations of the tertiary age.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is the oldest oil-producing state of India, home to Digboi, Naharkatiya and Moran-Hugrijan oilfields?",
            options: ["Gujarat", "Assam", "Maharashtra", "Rajasthan"],
            correct: 1,
            explanation:
              "Assam is the oldest oil-producing state of India, with Digboi, Naharkatiya and Moran-Hugrijan as important oilfields.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Ankleshwar is described as the most important petroleum field of which state?",
            options: ["Assam", "Gujarat", "Maharashtra", "Tamil Nadu"],
            correct: 1,
            explanation:
              "Ankleshwar is the most important petroleum field of Gujarat.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The first 1,700 km long cross-country gas pipeline, constructed by GAIL (India), linking Mumbai High and Bassein gas fields to industrial complexes in western and northern India, is known as the:",
            options: [
              "Salaya-Jalandhar Pipeline",
              "Hazira-Vijaipur-Jagdishpur (HVJ) Pipeline",
              "Kandla-Bhatinda Pipeline",
              "Paradip-Raipur-Ranchi Pipeline",
            ],
            correct: 1,
            explanation:
              "The 1,700 km long Hazira-Vijaipur-Jagdishpur (HVJ) cross-country gas pipeline, built by GAIL, linked Mumbai High and Bassein gas fields with industrial complexes in western and northern India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's sources of uranium and thorium for nuclear/atomic energy include Jharkhand and the Aravalli ranges of Rajasthan, along with thorium-rich monazite sands found in:",
            options: ["Odisha", "Kerala", "Tamil Nadu", "Gujarat"],
            correct: 1,
            explanation:
              "Uranium and Thorium are available in Jharkhand and the Aravalli ranges of Rajasthan, and the Monazite sands of Kerala are also rich in Thorium.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's largest wind farm cluster, stretching from Nagarcoil to Madurai, is located in:",
            options: ["Gujarat", "Rajasthan", "Tamil Nadu", "Maharashtra"],
            correct: 2,
            explanation:
              "India's largest wind farm cluster is located in Tamil Nadu, from Nagarcoil to Madurai.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Biogas plants using cattle dung, common in rural India and providing twin benefits of energy and improved manure, are locally known as:",
            options: ["Johads", "Gobar gas plants", "Khadins", "Tankas"],
            correct: 1,
            explanation:
              "Biogas plants using cattle dung are known as 'Gobar gas plants' in rural India, providing twin benefits of energy and improved manure quality.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which coastal locations are cited as providing ideal conditions for utilising tidal energy in India?",
            options: [
              "The Gulf of Mannar and Palk Strait",
              "The Gulf of Khambhat, the Gulf of Kuchchh and the Sunderban delta region",
              "The Malabar coast and Konkan coast",
              "The Coromandel coast and Northern Circars",
            ],
            correct: 1,
            explanation:
              "The Gulf of Khambhat, the Gulf of Kuchchh in Gujarat, and the Gangetic delta in the Sunderban region of West Bengal provide ideal conditions for utilising tidal energy.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's two experimental geothermal energy projects are located in the Parvati valley near Manikaran (Himachal Pradesh) and in:",
            options: ["Puga Valley, Ladakh", "Rohtang Valley, Himachal Pradesh", "Zanskar Valley, Ladakh", "Nubra Valley, Ladakh"],
            correct: 0,
            explanation:
              "The two experimental geothermal energy projects in India are located in the Parvati valley near Manikaran (Himachal Pradesh) and in the Puga Valley, Ladakh.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "manufacturing-industries-india",
        name: "Manufacturing Industries",
        questions: [
          q({
            text: "Besides raw material, power and labour, which two factors are essential requirements for setting up an industry?",
            options: ["Capital and entrepreneur", "Climate and rainfall", "Language and religion", "Population density alone"],
            correct: 0,
            explanation: "Beyond raw material, power and labour, capital investment and an entrepreneur to organise production are essential requirements for establishing any industry.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Asia's first Export Processing Zone (EPZ), established in 1965 to promote exports, was set up at:",
            options: ["Kandla, Gujarat", "Noida, Uttar Pradesh", "Falta, West Bengal", "Cochin, Kerala"],
            correct: 0,
            explanation: "Kandla in Gujarat was established as Asia's first Export Processing Zone in 1965, aimed at boosting India's export-oriented manufacturing.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which Indian state has the largest number of factories, driven by a strong base of textile, leather and engineering industries?",
            options: ["Tamil Nadu", "Maharashtra", "Gujarat", "West Bengal"],
            correct: 0,
            explanation: "Tamil Nadu has traditionally had the highest number of registered factories among Indian states, with a diversified industrial base including textiles, leather and engineering goods.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Mumbai, historically the hub of India's cotton textile industry due to its port access and humid climate, is often referred to as the:",
            options: ["Cottonopolis of India", "Manchester of India", "Silicon Valley of India", "Steel City of India"],
            correct: 0,
            explanation: "Mumbai's dominance in cotton textile manufacturing, aided by its port and humid climate favourable to spinning, earned it the title 'Cottonopolis of India' (Ahmedabad is often called the 'Manchester of India').",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Manufacturing industries are considered the backbone of economic development mainly because they:",
            options: [
              "Eliminate the need for agriculture entirely",
              "Reduce dependence on agricultural income by providing jobs in secondary and tertiary sectors",
              "Require no raw materials",
              "Only benefit urban populations",
            ],
            correct: 1,
            explanation:
              "Manufacturing industries help modernise agriculture and reduce the heavy dependence of people on agricultural income by providing jobs in secondary and tertiary sectors.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Industries such as cotton, jute, silk textile, rubber, sugar, tea and coffee, which derive raw materials from agriculture, are classified as:",
            options: ["Mineral-based industries", "Agro-based industries", "Forest-based industries", "Marine-based industries"],
            correct: 1,
            explanation:
              "Cotton, jute, silk textile, rubber, sugar, tea, coffee and edible oil industries are classified as agro-based industries.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Industries such as iron and steel, cement, aluminium and petrochemicals, which use minerals and metals as raw materials, are called:",
            options: ["Agro-based industries", "Mineral-based industries", "Basic industries only", "Consumer industries only"],
            correct: 1,
            explanation:
              "Iron and steel, cement, aluminium, machine tools and petrochemicals are examples of mineral-based industries.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Basic or key industries, such as iron and steel and copper smelting, are those which:",
            options: [
              "Produce goods for direct use by consumers",
              "Supply their products as raw materials to manufacture other goods",
              "Are always owned by the government",
              "Use only agricultural raw materials",
            ],
            correct: 1,
            explanation:
              "Basic or key industries supply their products as raw materials to manufacture other goods, e.g. iron and steel, copper smelting and aluminium smelting.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "BHEL and SAIL are examples of which type of industrial ownership?",
            options: ["Private sector", "Public sector", "Joint sector", "Cooperative sector"],
            correct: 1,
            explanation:
              "BHEL and SAIL are public sector industries, owned and operated by government agencies.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Oil India Ltd. (OIL), jointly owned by the public and private sector, is an example of a:",
            options: ["Private sector industry", "Public sector industry", "Joint sector industry", "Cooperative sector industry"],
            correct: 2,
            explanation:
              "Oil India Ltd. (OIL) is jointly owned by public and private sector, making it a joint sector industry.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The sugar industry in Maharashtra and the coir industry in Kerala are examples of which type of industrial ownership, where producers pool resources and share profits/losses?",
            options: ["Public sector", "Private sector", "Joint sector", "Cooperative sector"],
            correct: 3,
            explanation:
              "Cooperative sector industries are owned and operated by producers or suppliers of raw materials, who pool resources and share profits/losses proportionately — examples include the sugar industry in Maharashtra and the coir industry in Kerala.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On the basis of bulk and weight of raw material and finished goods, the iron and steel industry is classified as a:",
            options: ["Light industry", "Heavy industry", "Cottage industry", "Agro-based industry"],
            correct: 1,
            explanation:
              "Iron and steel is classified as a heavy industry, as opposed to light industries like electrical goods, based on the bulk and weight of raw material and finished goods.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The first successful textile mill in India was established in Mumbai in:",
            options: ["1818", "1854", "1904", "1947"],
            correct: 1,
            explanation:
              "The first successful textile mill was established in Mumbai in 1854.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "While spinning in the Indian textile industry continues to be centralised in Maharashtra, Gujarat and Tamil Nadu, weaving is:",
            options: [
              "Equally centralised in the same three states",
              "Highly decentralised to incorporate traditional skills and designs",
              "Carried out only in Mumbai",
              "Entirely mechanised with no handloom production",
            ],
            correct: 1,
            explanation:
              "Weaving is highly decentralised, providing scope for incorporating traditional skills and designs in cotton, silk, zari and embroidery.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India is the largest producer of raw jute and jute goods in the world, and stands second as an exporter after:",
            options: ["China", "Bangladesh", "Thailand", "Myanmar"],
            correct: 1,
            explanation:
              "India is the largest producer of raw jute and jute goods, and stands second as an exporter after Bangladesh.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The first jute mill in India was set up near Kolkata in 1855 at:",
            options: ["Howrah", "Rishra", "Barrackpore", "Serampore"],
            correct: 1,
            explanation:
              "The first jute mill was set up near Kolkata in 1855 at Rishra.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After the Partition of 1947, the jute mills remained in India, but about three-fourths of the jute-producing area went to which country (then East Pakistan)?",
            options: ["Nepal", "Bangladesh", "Myanmar", "Bhutan"],
            correct: 1,
            explanation:
              "After Partition in 1947, the jute mills remained in India but three-fourths of the jute producing area went to Bangladesh (then East Pakistan).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India occupies the world's first place in the production of gur and khandsari, and stands second (after Brazil) in the production of:",
            options: ["Rice", "Sugar", "Cotton", "Jute"],
            correct: 1,
            explanation:
              "India stands second as a world producer of sugar (after Brazil), while occupying first place in the production of gur and khandsari.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The sugar industry, being seasonal in nature, is ideally suited to which sector of ownership?",
            options: ["Public sector", "Private sector", "Joint sector", "Cooperative sector"],
            correct: 3,
            explanation:
              "Since the sugar industry is seasonal in nature, it is ideally suited to the cooperative sector.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In recent years, sugar mills have shown a tendency to shift and concentrate in southern and western states, especially Maharashtra, mainly because the cane produced there has:",
            options: [
              "Lower sucrose content",
              "Higher sucrose content, and the cooler climate ensures a longer crushing season",
              "No need for irrigation",
              "Cheaper transport costs to ports",
            ],
            correct: 1,
            explanation:
              "Cane produced in Maharashtra has a higher sucrose content, and the cooler climate ensures a longer crushing season, along with more successful cooperatives.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the iron and steel industry, iron ore, coking coal and limestone are required in an approximate ratio of:",
            options: ["1:1:1", "2:4:1", "4:2:1", "8:4:1"],
            correct: 2,
            explanation:
              "Iron ore, coking coal and limestone are required in the approximate ratio of 4:2:1 for iron and steel production.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which region has the maximum concentration of iron and steel industries in India, due to low-cost iron ore, high-grade raw materials in proximity, and cheap labour?",
            options: ["The Chotanagpur plateau region", "The Deccan plateau region", "The Gangetic plains", "The Western Ghats region"],
            correct: 0,
            explanation:
              "The Chotanagpur plateau region has the maximum concentration of iron and steel industries due to relative advantages like low-cost iron ore, high-grade raw materials nearby, and cheap labour.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Aluminium smelting, the second most important metallurgical industry in India, uses which bulky, dark reddish rock as its raw material?",
            options: ["Limestone", "Bauxite", "Mica", "Gypsum"],
            correct: 1,
            explanation:
              "Bauxite, a very bulky, dark reddish coloured rock, is the raw material used in aluminium smelters.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The two prime factors for the location of aluminium smelting plants are an assured source of raw material at minimum cost and:",
            options: ["Proximity to a seaport only", "A regular supply of electricity", "Proximity to a river only", "Availability of skilled labour only"],
            correct: 1,
            explanation:
              "Regular supply of electricity and an assured source of raw material at minimum cost are the two prime factors for locating aluminium smelting industries.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Inorganic chemicals produced by India's chemical industry include sulphuric acid, nitric acid, alkalies and:",
            options: ["Petrochemicals", "Soda ash", "Synthetic rubber", "Dye-stuffs"],
            correct: 1,
            explanation:
              "Inorganic chemicals include sulphuric acid, nitric acid, alkalies, soda ash and caustic soda.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Organic chemical plants, which produce petrochemicals used for synthetic fibres, plastics and pharmaceuticals, are typically located near:",
            options: ["Coal mines", "Oil refineries or petrochemical plants", "River deltas", "Ports exclusively"],
            correct: 1,
            explanation:
              "Organic chemical plants are located near oil refineries or petrochemical plants, since organic chemicals include petrochemicals.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's fertiliser industry is centred on nitrogenous fertilisers (mainly urea), phosphatic fertilisers, ammonium phosphate (DAP) and complex fertilisers, but relies entirely on imports for which nutrient?",
            options: ["Nitrogen", "Phosphate", "Potash", "Sulphur"],
            correct: 2,
            explanation:
              "Potash is entirely imported as the country does not have any reserves of commercially usable potash or potassium compounds.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The cement industry requires bulky and heavy raw materials such as limestone, silica and gypsum, along with coal, electric power and:",
            options: ["A coastal location only", "Rail transportation", "Abundant fresh water only", "Proximity to ports only"],
            correct: 1,
            explanation:
              "The cement industry requires bulky raw materials, coal and electric power, apart from rail transportation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The first cement plant in India was set up in 1904 in:",
            options: ["Mumbai", "Chennai", "Kolkata", "Ahmedabad"],
            correct: 1,
            explanation:
              "The first cement plant was set up in Chennai in 1904.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which city has emerged as the 'electronic capital of India'?",
            options: ["Mumbai", "Hyderabad", "Bengaluru", "Pune"],
            correct: 2,
            explanation:
              "Bengaluru has emerged as the electronic capital of India.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Industries are responsible for four main types of pollution: air, water, land and:",
            options: ["Thermal", "Noise", "Radioactive", "Chemical"],
            correct: 1,
            explanation:
              "Industries are responsible for four types of pollution: air, water, land and noise.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following is the correct sequence of industrial effluent treatment phases, as described in the chapter?",
            options: [
              "Tertiary, Secondary, Primary",
              "Primary (mechanical) → Secondary (biological) → Tertiary (biological, chemical and physical)",
              "Secondary, Primary, Tertiary",
              "Only Primary treatment is used in India",
            ],
            correct: 1,
            explanation:
              "Treatment of industrial effluents can be done in three phases: primary treatment by mechanical means, secondary treatment by biological process, and tertiary treatment by biological, chemical and physical processes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is identified as a major solid waste produced by the iron and steel industry, alongside fly ash and phospho-gypsum?",
            options: ["Iron and steel slag", "Sawdust", "Plastic waste", "Coconut husk"],
            correct: 0,
            explanation:
              "Fly ash, phospho-gypsum and iron and steel slags are the major solid wastes in India, as mentioned in the chapter.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "lifelines-of-national-economy",
        name: "Lifelines of National Economy",
        questions: [
          q({
            text: "Which Indian airport handles the largest volume of air cargo, serving as the country's busiest cargo hub?",
            options: ["Indira Gandhi International Airport, Delhi", "Chhatrapati Shivaji Maharaj International Airport, Mumbai", "Kempegowda International Airport, Bengaluru", "Chennai International Airport"],
            correct: 0,
            explanation: "Indira Gandhi International Airport in Delhi handles the largest volume of air cargo among Indian airports, reflecting its role as a major logistics and trade hub.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "India has the second largest road network in the world, aggregating to about how many km (2020-21)?",
            options: ["42.16 lakh km", "52.16 lakh km", "62.16 lakh km", "82.16 lakh km"],
            correct: 2,
            explanation:
              "India has the second largest road network in the world, aggregating to about 62.16 lakh km (2020-21).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT given as a reason for the growing importance of road transport over rail transport?",
            options: [
              "Lower construction cost than railway lines",
              "Ability to negotiate higher gradients and traverse mountains",
              "Provision of door-to-door service",
              "Greater fuel efficiency for very long-distance bulk transport",
            ],
            correct: 3,
            explanation:
              "Road transport's advantages include lower construction cost, ability to negotiate higher gradients, and door-to-door service — long-distance bulk transport fuel efficiency actually favours railways and waterways.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Golden Quadrilateral Super Highway project links which four mega cities by six-lane highways?",
            options: [
              "Delhi-Mumbai-Bengaluru-Chennai",
              "Delhi-Kolkata-Chennai-Mumbai",
              "Mumbai-Kolkata-Delhi-Hyderabad",
              "Chennai-Kolkata-Delhi-Pune",
            ],
            correct: 1,
            explanation:
              "The Golden Quadrilateral Super Highways link Delhi-Kolkata-Chennai-Mumbai by six-lane highways, implemented by NHAI.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The North-South Corridor connects Srinagar (Jammu & Kashmir) with which city in Tamil Nadu?",
            options: ["Chennai", "Kanniyakumari", "Madurai", "Coimbatore"],
            correct: 1,
            explanation:
              "The North-South corridor links Srinagar (Jammu & Kashmir) and Kanniyakumari (Tamil Nadu).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The East-West Corridor connects Silchar (Assam) with which city in Gujarat?",
            options: ["Ahmedabad", "Surat", "Porbander", "Vadodara"],
            correct: 2,
            explanation:
              "The East-West Corridor connects Silchar (Assam) and Porbander (Gujarat).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Roads linking a state capital with various district headquarters are classified as:",
            options: ["National Highways", "State Highways", "District Roads", "Border Roads"],
            correct: 1,
            explanation:
              "Roads linking a state capital with different district headquarters are known as State Highways.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Pradhan Mantri Gramin Sadak Yojana provides special impetus for which category of roads, aiming to link every village to a major town by an all-season motorable road?",
            options: ["National Highways", "State Highways", "Other roads (rural roads)", "Border Roads"],
            correct: 2,
            explanation:
              "Rural roads, classified under 'Other Roads', received special impetus under the Pradhan Mantri Gramin Sadak Yojana to link every village to a major town by an all-season motorable road.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Border Roads Organisation, established in 1960 to develop strategically important roads in the northern and north-eastern border areas, constructed the world's longest highway tunnel, the Atal Tunnel, connecting Manali to which valley?",
            options: ["Kullu Valley", "Lahul-Spiti Valley", "Kangra Valley", "Spiti-Zanskar Valley"],
            correct: 1,
            explanation:
              "The Atal Tunnel (9.02 km), built by the Border Roads Organisation in the Pir Panjal range, connects Manali to the Lahul-Spiti valley throughout the year.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Roads made of cement, concrete or bitumen, usable in all weather conditions, are classified as:",
            options: ["Unmetalled roads", "Metalled roads", "District roads", "Border roads"],
            correct: 1,
            explanation:
              "Metalled roads may be made of cement, concrete or bitumen, and are all-weather roads, unlike unmetalled roads which go out of use in the rainy season.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Indian Railways, the largest public sector undertaking in the country, ran its first train from Mumbai to Thane in 1853, covering a distance of:",
            options: ["21 km", "34 km", "56 km", "100 km"],
            correct: 1,
            explanation:
              "The first train steamed off from Mumbai to Thane in 1853, covering a distance of 34 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Indian Railway network is currently reorganised into how many zones (as per the chapter)?",
            options: ["9", "12", "17", "21"],
            correct: 2,
            explanation:
              "The Indian Railway is now reorganised into 17 zones.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following posed a major challenge to laying railway lines in the Himalayan mountainous regions?",
            options: [
              "Excessive rainfall alone",
              "High relief, sparse population, and lack of economic opportunities",
              "Lack of government funding",
              "Absence of any rivers",
            ],
            correct: 1,
            explanation:
              "The Himalayan mountainous regions are unfavourable for railway construction due to high relief, sparse population and lack of economic opportunities.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The development of the Konkan Railway along the west coast has faced problems such as sinking of tracks in some stretches and:",
            options: ["Frequent flooding only", "Landslides", "Track gauge mismatches", "Lack of tunnels"],
            correct: 1,
            explanation:
              "The Konkan Railway has faced problems such as sinking of track in some stretches and landslides.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the chapter, the Indian Railway network runs on multiple gauges, with Broad Gauge (1.676 m) accounting for the vast majority of the total 67,956 km route length, at approximately:",
            options: ["30,000 km", "45,000 km", "64,000 km", "67,000 km"],
            correct: 2,
            explanation:
              "Broad Gauge (1.676 m) accounts for about 63,950 km out of the total 67,956 km of the Indian Railway network.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which mode of transport, though having a high initial cost of laying, has minimal subsequent running costs and rules out trans-shipment losses or delays, and is used to transport crude oil, petroleum products and natural gas?",
            options: ["Roadways", "Railways", "Pipelines", "Waterways"],
            correct: 2,
            explanation:
              "Pipeline transport has a high initial cost but minimal running costs, and rules out trans-shipment losses or delays, used to transport crude oil, petroleum products and natural gas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Hazira-Vijaipur-Jagdishpur (HVJ) cross-country gas pipeline, constructed by GAIL (India), linked the Mumbai High and Bassein gas fields with industrial complexes in western and:",
            options: ["Southern India", "Northern India", "Eastern India", "North-eastern India"],
            correct: 1,
            explanation:
              "The HVJ pipeline linked Mumbai High and Bassein gas fields with fertilizer, power and industrial complexes in western and northern India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's inland navigation waterways total about 14,500 km in length, of which only how much is navigable by mechanised vessels?",
            options: ["1,700 km", "5,685 km", "10,000 km", "14,000 km"],
            correct: 1,
            explanation:
              "Out of India's 14,500 km of inland navigation waterways, only 5,685 km are navigable by mechanised vessels.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "National Waterway No. 1, running along the Ganga river between Allahabad and Haldia, covers a length of approximately:",
            options: ["891 km", "1,078 km", "1,620 km", "205 km"],
            correct: 2,
            explanation:
              "National Waterway No. 1, the Ganga river between Allahabad and Haldia, covers about 1,620 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "National Waterway No. 2, running along the Brahmaputra river, connects Sadiya and:",
            options: ["Guwahati", "Dhubri", "Dibrugarh", "Silchar"],
            correct: 1,
            explanation:
              "National Waterway No. 2 runs along the Brahmaputra river between Sadiya and Dhubri, a distance of 891 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Approximately what percentage of India's total trade volume is moved by sea?",
            options: ["50%", "68%", "80%", "95%"],
            correct: 3,
            explanation:
              "95 per cent of the country's trade volume (68 per cent in terms of value) is moved by sea.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Kandla, in Kuchchh, was the first port developed soon after Independence, mainly to ease the volume of trade on the Mumbai port following the loss of which port to Pakistan after Partition?",
            options: ["Chittagong", "Karachi", "Gwadar", "Chalna"],
            correct: 1,
            explanation:
              "Kandla was the first port developed after Independence to ease trade volume on Mumbai port, following the loss of Karachi port to Pakistan after Partition.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Kandla port is also known by which other name?",
            options: ["Deendayal Port", "Jawaharlal Nehru Port", "Nhava Sheva Port", "Sardar Patel Port"],
            correct: 0,
            explanation:
              "Kandla, a tidal port, is also known as Deendayal Port.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which port is described as India's premier iron ore exporting port, accounting for about fifty per cent of the country's iron ore exports?",
            options: ["Kandla", "Marmagao", "Vishakhapatnam", "Tuticorin"],
            correct: 1,
            explanation:
              "Marmagao port (Goa) is the premier iron ore exporting port of the country, accounting for about fifty per cent of India's iron ore exports.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Jawaharlal Nehru Port (JNPT) was planned with a view to decongest which major port?",
            options: ["Kolkata", "Chennai", "Mumbai", "Kochi"],
            correct: 2,
            explanation:
              "The Jawaharlal Nehru port was planned with a view to decongest the Mumbai port and serve as a hub port for the region.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Vishakhapatnam, the deepest landlocked and well-protected port, was originally conceived as an outlet for the export of:",
            options: ["Coal", "Iron ore", "Bauxite", "Manganese"],
            correct: 1,
            explanation:
              "Vishakhapatnam, the deepest landlocked and well-protected port, was originally conceived as an outlet for iron ore exports.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Kolkata, an inland riverine port serving the Ganga-Brahmaputra basin hinterland, requires constant dredging of which river because it is a tidal port?",
            options: ["Ganga", "Hooghly", "Brahmaputra", "Mahanadi"],
            correct: 1,
            explanation:
              "Being a tidal port, Kolkata requires constant dredging of the Hooghly river.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The UDAN (Ude Desh ka Aam Nagrik) scheme, aimed at promoting regional air connectivity and making flying affordable, was conceived by the:",
            options: ["Ministry of Railways", "Ministry of Civil Aviation", "Ministry of Road Transport and Highways", "Ministry of Shipping"],
            correct: 1,
            explanation:
              "The UDAN scheme (Regional Connectivity Scheme) was conceived by the Ministry of Civil Aviation (MoCA) to promote regional connectivity through affordable flying.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Indian postal network, the largest in the world, introduced six mail channels for quick delivery, including the Rajdhani Channel, Metro Channel, Green Channel, Business Channel, Bulk Mail Channel and:",
            options: ["Express Channel", "Periodical Channel", "Priority Channel", "Speed Channel"],
            correct: 1,
            explanation:
              "The six mail channels introduced are Rajdhani Channel, Metro Channel, Green Channel, Business Channel, Bulk Mail Channel and Periodical Channel.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Doordarshan, India's national television channel and one of the largest terrestrial networks in the world, broadcasts programmes for entertainment, education and:",
            options: ["Only news", "Sports and other categories", "Only agricultural information", "Only government announcements"],
            correct: 1,
            explanation:
              "Doordarshan broadcasts a variety of programmes from entertainment, educational to sports, etc. for people of different age groups.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "India publishes newspapers in about 100 languages and dialects. According to the chapter, the largest number of newspapers are published in Hindi, followed by English and:",
            options: ["Urdu", "Bengali", "Tamil", "Marathi"],
            correct: 0,
            explanation:
              "The largest number of newspapers published in the country are in Hindi, followed by English and Urdu.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "When the value of a country's exports exceeds the value of its imports, this is called:",
            options: ["An unfavourable balance of trade", "A favourable balance of trade", "A trade deficit", "A current account deficit"],
            correct: 1,
            explanation:
              "When the value of exports exceeds the value of imports, it is called a favourable balance of trade.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the chapter, more than how many people are directly engaged in India's tourism industry?",
            options: ["5 million", "10 million", "15 million", "25 million"],
            correct: 2,
            explanation:
              "More than 15 million people are directly engaged in the tourism industry, as cited in the chapter.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "geography-as-a-discipline",
        name: "Geography as a Discipline",
        questions: [
          q({
            text: "The term 'geography' was first coined by which Greek scholar (276-194 BC)?",
            options: ["Ptolemy", "Eratosthenese", "Herodotus", "Aristotle"],
            correct: 1,
            explanation:
              "The term geography was first coined by Eratosthenese, a Greek scholar (276-194 BC).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The word 'geography' is derived from the Greek roots 'geo' and 'graphos', meaning:",
            options: ["Earth and measurement", "Earth and description", "Land and study", "World and science"],
            correct: 1,
            explanation:
              "Geography is derived from geo (earth) and graphos (description), together meaning 'description of the earth'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The systematic approach to studying geography, treating a phenomenon as a whole across the world before identifying spatial patterns, was introduced by which German geographer?",
            options: ["Karl Ritter", "Alexander Von Humboldt", "Immanuel Kant", "Friedrich Ratzel"],
            correct: 1,
            explanation:
              "The systematic geography approach was introduced by Alexander Von Humboldt (1769-1859).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The regional approach to geography, in which the world is divided into regions and studied holistically, was developed by:",
            options: ["Alexander Von Humboldt", "Karl Ritter", "Eratosthenese", "Richard Hartshorne"],
            correct: 1,
            explanation:
              "The regional geography approach was developed by Karl Ritter (1779-1859), a contemporary of Humboldt.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Geography as a discipline is concerned with three sets of questions: 'what', 'where', and:",
            options: ["'When'", "'Why'", "'Who'", "'How much'"],
            correct: 1,
            explanation:
              "Geography addresses 'what' (identification of patterns), 'where' (distribution/location), and 'why' (causal relationships).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the chapter, it was the addition of which question that made geography a scientific discipline, beyond merely inventorying 'what' and 'where'?",
            options: ["'When'", "'Why'", "'Who'", "'How'"],
            correct: 1,
            explanation:
              "The 'what' and 'where' questions did not make geography a scientific discipline until the third question, 'why' (explaining causal relationships), was added.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Time is described in the chapter as the fourth dimension of geography because:",
            options: [
              "Distance can be converted into time and vice versa",
              "Geography does not study historical change",
              "Maps cannot show time",
              "Time has no relationship with space",
            ],
            correct: 0,
            explanation:
              "The chapter notes it is possible to convert time into space and space into time (e.g. a distance expressed in km or in hours of travel), making time an integral fourth dimension of geographical study.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which branch of physical geography studies landforms, their evolution and related processes?",
            options: ["Climatology", "Geomorphology", "Hydrology", "Soil Geography"],
            correct: 1,
            explanation:
              "Geomorphology is devoted to the study of landforms, their evolution and related processes.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which branch of geography studies the structure of the atmosphere and elements of weather and climate?",
            options: ["Geomorphology", "Climatology", "Oceanography", "Biogeography"],
            correct: 1,
            explanation:
              "Climatology encompasses the study of the structure of atmosphere and elements of weather and climates.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Population and settlement geography, social/cultural geography, and economic geography are branches of:",
            options: ["Physical geography", "Human geography", "Biogeography", "Regional geography"],
            correct: 1,
            explanation:
              "Human geography includes social/cultural geography, population and settlement geography, economic geography, historical geography and political geography.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which branch of geography, developing at the interface of physical and human geography, includes plant geography and zoo geography?",
            options: ["Political geography", "Biogeography", "Historical geography", "Economic geography"],
            correct: 1,
            explanation:
              "Biogeography, at the interface of physical and human geography, includes plant geography, zoo geography, ecology and environmental geography.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Techniques such as Remote Sensing, GIS and GPS fall under which category of geographic methods and techniques?",
            options: ["Cartography", "Geo-informatics", "Quantitative techniques", "Field survey methods"],
            correct: 1,
            explanation:
              "Geo-informatics comprises techniques such as Remote Sensing, GIS and GPS, as one of the methods and techniques used in geography.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Physical geography includes the study of the lithosphere, atmosphere, hydrosphere and:",
            options: ["Anthroposphere", "Biosphere", "Technosphere", "Cryosphere"],
            correct: 1,
            explanation:
              "Physical geography includes the study of the lithosphere, atmosphere, hydrosphere and biosphere, along with soils formed through pedogenesis.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "origin-and-evolution-of-the-earth",
        name: "The Origin and Evolution of the Earth",
        questions: [
          q({
            text: "The 'Nebular Hypothesis', considering planets formed out of a cloud of material associated with a youthful sun, was originally proposed by Immanuel Kant and later revised in 1796 by:",
            options: ["Laplace", "Chamberlain", "Otto Schmidt", "James Jeans"],
            correct: 0,
            explanation:
              "The Nebular Hypothesis, first proposed by German philosopher Immanuel Kant, was revised by mathematician Laplace in 1796.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The most popular argument regarding the origin of the universe, also called the 'expanding universe hypothesis', is the:",
            options: ["Nebular Hypothesis", "Big Bang Theory", "Binary Theory", "Steady State Theory"],
            correct: 1,
            explanation:
              "The Big Bang Theory, also called the expanding universe hypothesis, is the most popular argument for the origin of the universe.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Edwin Hubble provided evidence in 1920 that:",
            options: [
              "The earth was formed from a nebula",
              "The universe is expanding",
              "The moon separated from the Pacific basin",
              "Continents were once joined",
            ],
            correct: 1,
            explanation:
              "Edwin Hubble provided evidence in 1920 that the universe is expanding, with galaxies moving further apart over time.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the Big Bang Theory, the event is now generally accepted to have taken place how long before the present?",
            options: ["4.6 billion years", "13.7 billion years", "1 billion years", "500 million years"],
            correct: 1,
            explanation:
              "It is now generally accepted that the Big Bang took place 13.7 billion years before the present.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Fred Hoyle proposed an alternative to the expanding universe, known as the concept of:",
            options: ["Steady state", "Binary star formation", "Continental drift", "Nebular condensation"],
            correct: 0,
            explanation:
              "Hoyle's concept of steady state considered the universe to be roughly the same at any point of time, an alternative to the expanding universe theory.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Our solar system's nebula started its collapse and core formation about 5-5.6 billion years ago, with the planets themselves forming about:",
            options: ["13.7 billion years ago", "4.6 billion years ago", "1 billion years ago", "500 million years ago"],
            correct: 1,
            explanation:
              "The planets of our solar system were formed about 4.6 billion years ago, after the nebula's collapse began 5-5.6 billion years ago.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mercury, Venus, Earth and Mars are called terrestrial (inner) planets because they:",
            options: [
              "Have thick atmospheres of helium and hydrogen",
              "Are made up of rock and metals with relatively high densities",
              "Lie beyond the belt of asteroids",
              "Are larger than the outer planets",
            ],
            correct: 1,
            explanation:
              "Terrestrial planets are earth-like, made up of rock and metals with relatively high densities, unlike the gaseous Jovian (outer) planets.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The theory that the moon was formed as a result of a 'giant impact' or 'big splat', when a body one to three times the size of Mars collided with the earth, replaced an earlier 1838 theory proposed by:",
            options: ["Edwin Hubble", "Sir George Darwin", "Alfred Wegener", "Arthur Holmes"],
            correct: 1,
            explanation:
              "The 1838 theory by Sir George Darwin (that earth and moon formed a single rotating body that later split) is no longer accepted; the 'giant impact' theory is now the generally accepted explanation.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The process by which heavier materials (like iron) sank towards the earth's centre while lighter materials moved towards the surface, leading to the layered structure of the earth, is called:",
            options: ["Differentiation", "Degassing", "Denudation", "Diastrophism"],
            correct: 0,
            explanation:
              "Differentiation is the process by which earth-forming material got separated into different layers based on density, forming the crust, mantle, outer core and inner core.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The process through which gases were released from the earth's interior during its cooling, contributing to the evolution of the early atmosphere, is called:",
            options: ["Differentiation", "Degassing", "Sublimation", "Condensation"],
            correct: 1,
            explanation:
              "Degassing is the process through which gases and water vapour were outpoured from the earth's interior, contributing to the evolution of the early atmosphere.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The early atmosphere of the earth largely contained water vapour, nitrogen, carbon dioxide, methane, ammonia and very little of:",
            options: ["Argon", "Free oxygen", "Helium", "Hydrogen"],
            correct: 1,
            explanation:
              "The early atmosphere contained very little free oxygen — oxygen began to flood the atmosphere only around 2,000 million years ago, after photosynthesis evolved.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The earth's oceans are believed to have formed within how many million years from the formation of the earth?",
            options: ["100 million years", "500 million years", "1 billion years", "2 billion years"],
            correct: 1,
            explanation:
              "The earth's oceans were formed within 500 million years from the formation of the earth, telling us the oceans are as old as about 4,000 million years.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Around 2,500-3,000 million years before the present, which crucial biological process evolved, eventually leading oxygen to flood the atmosphere about 2,000 million years ago?",
            options: ["Respiration", "Photosynthesis", "Fermentation", "Nitrogen fixation"],
            correct: 1,
            explanation:
              "Around 2,500-3,000 million years before the present, the process of photosynthesis evolved, and oceans became saturated with oxygen, which then began to flood the atmosphere.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the Geological Time Scale given in the chapter, the extinction of dinosaurs occurred during which period?",
            options: ["Jurassic", "Cretaceous", "Triassic", "Permian"],
            correct: 1,
            explanation:
              "The Geological Time Scale places the extinction of dinosaurs at the Cretaceous period (65-144 million years before present).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Modern Man (Homo Sapiens) appears in the Geological Time Scale during which epoch?",
            options: ["Pliocene", "Pleistocene", "Miocene", "Oligocene"],
            correct: 1,
            explanation:
              "According to the Geological Time Scale, Homo Sapiens (Modern Man) appear during the Pleistocene epoch (0-10,000 years before present).",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "interior-of-the-earth",
        name: "Interior of the Earth",
        questions: [
          q({
            text: "The Earth's core, sometimes referred to by the term 'Nife' layer, is composed mainly of which two elements?",
            options: ["Nickel and Iron", "Nitrogen and Iron", "Nickel and Silicon", "Iron and Aluminium"],
            correct: 0,
            explanation: "'Nife' is a term derived from Nickel (Ni) and Ferrum/Iron (Fe), the two dominant elements believed to compose the Earth's dense core.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The most easily available solid earth material for direct study, obtained from mining areas such as gold mines in South Africa, reaches depths of about:",
            options: ["1 km", "3-4 km", "10 km", "50 km"],
            correct: 1,
            explanation:
              "Gold mines in South Africa are as deep as 3-4 km — going beyond this is not possible as it is very hot at such depths.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The deepest drill at Kola, in the Arctic Ocean, as part of major scientific drilling projects, has reached a depth of about:",
            options: ["4 km", "12 km", "25 km", "50 km"],
            correct: 1,
            explanation:
              "The deepest drill at Kola in the Arctic Ocean has so far reached a depth of 12 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A difference between the observed and expected value of gravity at a location, providing information about the distribution of mass within the earth's crust, is called:",
            options: ["Gravity anomaly", "Magnetic anomaly", "Isostatic adjustment", "Seismic gap"],
            correct: 0,
            explanation:
              "When the reading of gravity at a place differs from the expected value, such a difference is called a gravity anomaly.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A sharp break in crustal rocks, along which the release of energy during an earthquake occurs, is called a:",
            options: ["Joint", "Fault", "Fold", "Fracture zone"],
            correct: 1,
            explanation:
              "A fault is a sharp break in the crustal rocks; the release of energy causing an earthquake occurs along a fault.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The point within the earth where an earthquake's energy is released is called the focus (or hypocentre), while the point on the surface directly above it is called the:",
            options: ["Epicentre", "Apex", "Zenith", "Datum"],
            correct: 0,
            explanation:
              "The epicentre is the point on the surface nearest to the focus, and the first point to experience the earthquake waves.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which type of earthquake waves are the fastest, travelling through gaseous, liquid and solid materials, and are also called 'primary waves'?",
            options: ["S-waves", "P-waves", "Surface waves", "Love waves"],
            correct: 1,
            explanation:
              "P-waves (primary waves) move fastest and are the first to arrive at the surface, travelling through gaseous, liquid and solid materials.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which type of body waves can travel only through solid materials, a characteristic that helped scientists understand the earth's interior structure?",
            options: ["P-waves", "S-waves", "Surface waves", "Rayleigh waves"],
            correct: 1,
            explanation:
              "S-waves (secondary waves) can travel only through solid materials — this property helped scientists infer that the outer core is liquid.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Surface waves, generated by the interaction of body waves with surface rocks, are considered the most damaging because they:",
            options: [
              "Travel fastest through the earth",
              "Cause displacement of rocks and collapse of structures",
              "Only occur in solid materials",
              "Travel only through gaseous materials",
            ],
            correct: 1,
            explanation:
              "Surface waves, the last to report on seismographs, are more destructive as they cause displacement of rocks and the collapse of structures.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The zone where seismographs record P-waves but not S-waves, located between 105° and 145° from the earthquake's epicentre, is called the:",
            options: ["Focus zone", "Shadow zone", "Epicentral zone", "Convergence zone"],
            correct: 1,
            explanation:
              "This is called the shadow zone; the S-wave shadow zone is larger than that of P-waves, covering just over 40 per cent of the earth's surface.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Earthquakes generated due to the sliding of rocks along a fault plane, the most common type, are called:",
            options: ["Volcanic earthquakes", "Tectonic earthquakes", "Collapse earthquakes", "Explosion earthquakes"],
            correct: 1,
            explanation:
              "Tectonic earthquakes, the most common type, are generated due to sliding of rocks along a fault plane.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The magnitude of an earthquake, expressed in numbers from 0-10 and relating to the energy released, is measured on the:",
            options: ["Mercalli scale", "Richter scale", "Beaufort scale", "Fujita scale"],
            correct: 1,
            explanation:
              "Earthquake magnitude, relating to the energy released, is measured on the Richter scale, expressed in numbers 0-10.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The intensity of an earthquake, based on the visible damage caused and ranging from 1-12, is measured on a scale named after:",
            options: ["Richter", "Mercalli", "Beaufort", "Kelvin"],
            correct: 1,
            explanation:
              "The intensity scale, taking into account visible damage and ranging from 1-12, is named after Mercalli, an Italian seismologist.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The mean thickness of the oceanic crust (about 5 km) is much less than that of the continental crust (about 30 km), with the continental crust being thickest — up to 70 km — in which region?",
            options: ["The Andes", "The Himalayan region", "The Rockies", "The Alps"],
            correct: 1,
            explanation:
              "The continental crust is thicker in areas of major mountain systems, being as much as 70 km thick in the Himalayan region.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The weaker zone in the upper mantle, extending up to about 400 km, which is the main source of magma reaching the surface during volcanic eruptions, is called the:",
            options: ["Lithosphere", "Asthenosphere", "Mesosphere", "Barysphere"],
            correct: 1,
            explanation:
              "The asthenosphere ('astheno' means weak), extending up to about 400 km, is the main source of magma finding its way to the surface.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The core-mantle boundary is located at a depth of about 2,900 km; the outer core is in liquid state while the inner core is:",
            options: ["Also liquid", "In solid state", "In gaseous state", "In plasma state"],
            correct: 1,
            explanation:
              "The outer core is in a liquid state while the inner core is in a solid state, with the core-mantle boundary at 2,900 km depth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The core of the earth, made up mostly of nickel and iron, is sometimes referred to as the:",
            options: ["Sial layer", "Nife layer", "Sima layer", "Regolith layer"],
            correct: 1,
            explanation:
              "The core, made of heavy material mostly constituted by nickel and iron, is sometimes referred to as the nife layer.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Shield volcanoes, the largest of all volcanoes (barring basalt flows) and typified by the Hawaiian volcanoes, are mostly made up of which type of lava?",
            options: ["Andesitic lava", "Basalt", "Rhyolite", "Pumice"],
            correct: 1,
            explanation:
              "Shield volcanoes, like the famous Hawaiian volcanoes, are mostly made up of basalt, a type of lava that is very fluid when erupted.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Deccan Traps of India, presently covering most of the Maharashtra plateau, are a major example of which type of volcanic landform?",
            options: ["Composite volcano", "Flood basalt province", "Caldera", "Cinder cone"],
            correct: 1,
            explanation:
              "The Deccan Traps are a much larger flood basalt province, formed by highly fluid lava that flowed for long distances and covered vast areas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Large dome-shaped intrusive igneous bodies with a level base, connected by a pipe-like conduit and often found as exfoliated granite domal hills in the Karnataka plateau, are called:",
            options: ["Batholiths", "Lacoliths", "Sills", "Dykes"],
            correct: 1,
            explanation:
              "Lacoliths are large dome-shaped intrusive bodies with a level base, connected by a pipe-like conduit — the Karnataka plateau's granite domal hills are examples.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "When magma moving upward through cracks and fissures solidifies almost perpendicular to the ground, forming wall-like structures common in western Maharashtra and considered feeders for the Deccan traps, these are called:",
            options: ["Sills", "Dykes", "Lapoliths", "Phacoliths"],
            correct: 1,
            explanation:
              "Dykes are wall-like intrusive structures formed when lava solidifies almost perpendicular to the ground in cracks and fissures — commonly found in western Maharashtra as feeders for the Deccan traps.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "distribution-of-oceans-and-continents",
        name: "Distribution of Oceans and Continents",
        questions: [
          q({
            text: "Continents cover what percentage of the earth's surface, with the remainder under oceanic waters?",
            options: ["21%", "29%", "40%", "50%"],
            correct: 1,
            explanation:
              "Continents cover 29 per cent of the earth's surface, with the remainder under oceanic waters.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Alfred Wegener, a German meteorologist, put forth the 'Continental Drift Theory' in:",
            options: ["1596", "1912", "1930", "1961"],
            correct: 1,
            explanation:
              "Alfred Wegener put forth a comprehensive argument called the 'continental drift theory' in 1912.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to Wegener, the single supercontinent that once existed, surrounded by a mega-ocean, was named:",
            options: ["Gondwanaland", "Pangaea", "Laurasia", "Rodinia"],
            correct: 1,
            explanation:
              "According to Wegener, all continents formed a single continental mass called Pangaea, meaning 'all earth'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The mega-ocean that surrounded Pangaea, meaning 'all water', was called:",
            options: ["Tethys", "Panthalassa", "Pacifica", "Panthalassia"],
            correct: 1,
            explanation:
              "The mega-ocean surrounding Pangaea was called Panthalassa, meaning 'all water'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to Wegener, Pangaea first broke into two large continental masses called Laurasia (north) and:",
            options: ["Eurasia", "Gondwanaland", "Pacifica", "Atlantica"],
            correct: 1,
            explanation:
              "Pangaea first broke into Laurasia (forming the northern component) and Gondwanaland (forming the southern component).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The remarkable matching of the coastlines of Africa and South America, presented as a computer-generated best-fit map in 1964, was demonstrated by:",
            options: ["Wegener", "Bullard", "Hess", "Holmes"],
            correct: 1,
            explanation:
              "Bullard, in 1964, produced a computer-generated map showing the best fit of the Atlantic margin, proving quite perfect.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Tillite, a sedimentary rock formed from glacial deposits found across India, Africa, Falkland Islands, Madagascar, Antarctica and Australia, is important evidence for continental drift because it indicates:",
            options: [
              "Volcanic activity",
              "Extensive and prolonged glaciation and drifting continents",
              "Marine deposits of the Jurassic age",
              "River erosion patterns",
            ],
            correct: 1,
            explanation:
              "Tillite provides unambiguous evidence of palaeoclimates and drifting continents, showing that these landmasses had remarkably similar glacial histories.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Wegener suggested that the continents drifted due to which two forces?",
            options: [
              "Gravity and magnetism",
              "Pole-fleeing force and tidal force",
              "Convection currents and subduction",
              "Coriolis force and pressure gradient force",
            ],
            correct: 1,
            explanation:
              "Wegener suggested the pole-fleeing force (related to earth's rotation and equatorial bulge) and tidal force (from the sun and moon's attraction) as forces for drifting.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Convectional Current Theory, which proposed convection currents in the mantle as the driving force for continental movement, was put forward in the 1930s by:",
            options: ["Alfred Wegener", "Arthur Holmes", "Harry Hess", "McKenzie"],
            correct: 1,
            explanation:
              "Arthur Holmes, in the 1930s, discussed the possibility of convection currents operating in the mantle, providing a possible explanation for the force behind continental movement.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The hypothesis of 'sea floor spreading', explaining the rupture and pushing apart of oceanic crust due to eruptions at mid-oceanic ridges, was proposed in 1961 by:",
            options: ["Arthur Holmes", "Harry Hess", "Alfred Wegener", "John Morgan"],
            correct: 1,
            explanation:
              "Hess (1961) proposed the 'sea floor spreading' hypothesis, based on detailed analysis of ocean floor mapping and magnetic properties of rocks.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to sea floor spreading evidence, rocks closer to the mid-oceanic ridge crest are the youngest and have normal polarity, while the age of rocks:",
            options: [
              "Decreases as one moves away from the crest",
              "Increases as one moves away from the crest",
              "Remains constant regardless of distance",
              "Is unrelated to distance from the crest",
            ],
            correct: 1,
            explanation:
              "The age of oceanic rocks increases as one moves away from the mid-oceanic ridge crest, supporting the sea floor spreading hypothesis.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The theory of Plate Tectonics, collecting available ideas about sea floor spreading, was proposed independently in 1967 by McKenzie and Parker, and also by:",
            options: ["Arthur Holmes", "Morgan", "Alfred Wegener", "Bullard"],
            correct: 1,
            explanation:
              "In 1967, McKenzie and Parker, and also Morgan, independently came out with the concept of Plate Tectonics.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to plate tectonics theory, the earth's lithosphere is divided into how many major plates?",
            options: ["Five", "Six", "Seven", "Nine"],
            correct: 2,
            explanation:
              "The theory of plate tectonics proposes that the earth's lithosphere is divided into seven major plates and some minor plates.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Boundaries where new crust is generated as plates pull away from each other, such as the Mid-Atlantic Ridge, are called:",
            options: ["Convergent boundaries", "Divergent boundaries", "Transform boundaries", "Subduction zones"],
            correct: 1,
            explanation:
              "Divergent boundaries are sites where new crust is generated as plates pull away from each other — the Mid-Atlantic Ridge is the best-known example.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Boundaries where the crust is destroyed as one plate dives under another, forming a subduction zone, are called:",
            options: ["Divergent boundaries", "Convergent boundaries", "Transform boundaries", "Spreading sites"],
            correct: 1,
            explanation:
              "Convergent boundaries are where the crust is destroyed as one plate dives under another, forming a subduction zone.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Boundaries where the crust is neither produced nor destroyed, as plates slide horizontally past each other, are called:",
            options: ["Divergent boundaries", "Convergent boundaries", "Transform boundaries", "Rift boundaries"],
            correct: 2,
            explanation:
              "Transform boundaries are where the crust is neither produced nor destroyed as plates slide horizontally past each other.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Among tectonic plates, which is cited as having the slowest rate of movement (less than 2.5 cm/year)?",
            options: ["The East Pacific Rise", "The Arctic Ridge", "The Pacific Plate", "The Indian Plate"],
            correct: 1,
            explanation:
              "The Arctic Ridge has the slowest rate of plate movement (less than 2.5 cm/year), while the East Pacific Rise has the fastest (more than 15 cm/year).",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "India collided with Asia about 40-50 million years ago, causing the rapid uplift of the Himalayas; before this, India was separated from the Asian continent by the:",
            options: ["Indian Ocean", "Tethys Sea", "Arabian Sea", "Bay of Bengal"],
            correct: 1,
            explanation:
              "India was separated from the Asian continent by the Tethys Sea until about 225 million years ago, before colliding with Asia 40-50 million years ago.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "minerals-and-rocks",
        name: "Minerals and Rocks",
        questions: [
          q({
            text: "Which of the following statements about metamorphic rocks is/are correct? I. They are generally denser and harder than their parent (protolith) rock. II. They do not contain fossils. III. Conglomerate is a type of metamorphic rock.",
            options: [
              "Only statements I and II are correct",
              "Only statement III is correct",
              "All three statements are correct",
              "None of the statements is correct",
            ],
            correct: 0,
            explanation: "Metamorphic rocks are typically denser and harder than the original rock due to heat and pressure, and the metamorphic process destroys any fossils present. Conglomerate, however, is a sedimentary rock, not a metamorphic one, making statement III incorrect.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "About 98 per cent of the earth's crust is composed of eight elements, including oxygen, silicon, aluminium, iron, calcium, sodium, potassium and:",
            options: ["Titanium", "Magnesium", "Manganese", "Nickel"],
            correct: 1,
            explanation:
              "About 98 per cent of the crust is composed of oxygen, silicon, aluminium, iron, calcium, sodium, potassium and magnesium.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A mineral is defined as a naturally occurring organic or inorganic substance having an orderly atomic structure and:",
            options: [
              "Only a metallic lustre",
              "A definite chemical composition and physical properties",
              "No fixed composition",
              "Only crystalline structure but no chemical formula",
            ],
            correct: 1,
            explanation:
              "A mineral is a naturally occurring organic and inorganic substance, having an orderly atomic structure and a definite chemical composition and physical properties.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The relative resistance of a mineral to being scratched, measured on a scale from 1 to 10, is called its:",
            options: ["Lustre", "Cleavage", "Hardness", "Streak"],
            correct: 2,
            explanation:
              "Hardness is the relative resistance of a mineral to being scratched, with ten minerals selected to measure the degree of hardness from 1-10.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "On the Mohs hardness scale used in the chapter, which is the hardest mineral, rated 10?",
            options: ["Quartz", "Topaz", "Corundum", "Diamond"],
            correct: 3,
            explanation:
              "Diamond is rated 10, the hardest on the scale, followed by corundum (9), topaz (8) and quartz (7).",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The colour of the ground powder of a mineral, which may differ from the mineral's own colour, is called its:",
            options: ["Lustre", "Streak", "Cleavage", "Fracture"],
            correct: 1,
            explanation:
              "Streak is the colour of the ground powder of a mineral — for example, fluorite is purple or green but gives a white streak.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Metallic minerals containing metal content are subdivided into precious metals, ferrous metals, and:",
            options: ["Radioactive metals", "Non-ferrous metals", "Alkali metals", "Noble metals"],
            correct: 1,
            explanation:
              "Metallic minerals are subdivided into precious metals (gold, silver, platinum), ferrous metals (iron and metals mixed with iron), and non-ferrous metals (copper, lead, zinc, tin, aluminium).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rocks are aggregates of one or more minerals, and the science of rocks is called:",
            options: ["Mineralogy", "Petrology", "Pedology", "Geomorphology"],
            correct: 1,
            explanation:
              "Petrology is the science of rocks; a petrologist studies rocks' mineral composition, texture, structure, origin and occurrence.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Igneous rocks, formed when magma cools and solidifies, are also known as primary rocks because the word 'Igneous' (from the Latin 'Ignis') means:",
            options: ["Rock", "Fire", "Settle", "Change"],
            correct: 1,
            explanation:
              "'Igneous' comes from the Latin 'Ignis' meaning fire, referring to their formation from cooling magma or lava.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Granite, formed by slow cooling of molten material at great depths resulting in large mineral grains, is an example of an igneous rock, unlike basalt, which forms from:",
            options: ["Slow cooling at depth", "Sudden cooling at the surface", "Metamorphism", "Sedimentation"],
            correct: 1,
            explanation:
              "Basalt forms from sudden cooling at the surface, producing small, smooth grains, in contrast to granite's large grains from slow cooling at depth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The word 'sedimentary' is derived from the Latin word 'sedimentum', meaning:",
            options: ["Fire", "Settling", "Change of form", "Layering"],
            correct: 1,
            explanation:
              "'Sedimentary' comes from the Latin 'sedimentum', meaning settling.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The process by which loose sediment deposits are compacted and turned into sedimentary rock is called:",
            options: ["Metamorphism", "Lithification", "Weathering", "Denudation"],
            correct: 1,
            explanation:
              "Lithification is the process by which deposits are compacted through, turning them into sedimentary rocks.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is an example of an organically formed sedimentary rock?",
            options: ["Sandstone", "Conglomerate", "Coal", "Chert"],
            correct: 2,
            explanation:
              "Coal, along with geyserite, chalk and limestone, is an example of an organically formed sedimentary rock; sandstone and conglomerate are mechanically formed.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Metamorphic rocks, whose name means 'change of form', are classified into two major groups: foliated rocks and:",
            options: ["Igneous rocks", "Non-foliated rocks", "Clastic rocks", "Chemical rocks"],
            correct: 1,
            explanation:
              "Metamorphic rocks are classified into two major groups: foliated rocks and non-foliated rocks.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "When rocks come in contact with hot intruding magma and lava and recrystallise under high temperatures, this is called:",
            options: ["Regional metamorphism", "Contact metamorphism", "Dynamic metamorphism", "Chemical weathering"],
            correct: 1,
            explanation:
              "In contact metamorphism, rocks come in contact with hot intruding magma and lava and recrystallise under high temperatures.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The rock cycle describes the continuous process through which old rocks are transformed into new ones; igneous rocks are considered 'primary' rocks because:",
            options: [
              "They form last in the cycle",
              "Other rocks (sedimentary and metamorphic) form from these primary rocks",
              "They cannot be transformed further",
              "They only occur on ocean floors",
            ],
            correct: 1,
            explanation:
              "Igneous rocks are primary rocks, and other rocks (sedimentary and metamorphic) form from these primary rocks in the continuous rock cycle.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "geomorphic-processes",
        name: "Geomorphic Processes",
        questions: [
          q({
            text: "The internal forces that build up parts of the earth's surface are called endogenic forces, while the external forces that wear down relief are called:",
            options: ["Diastrophic forces", "Exogenic forces", "Isostatic forces", "Volcanic forces"],
            correct: 1,
            explanation:
              "Exogenic forces are external forces, mainly land-wearing, as opposed to endogenic (internal, land-building) forces.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The phenomenon of wearing down of relief variations of the earth's surface through erosion is known as:",
            options: ["Aggradation", "Gradation", "Diastrophism", "Lithification"],
            correct: 1,
            explanation:
              "Gradation is the wearing down of relief variations through erosion, as a result of exogenic forces.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Orogenic processes, involving mountain building through severe folding, are a type of:",
            options: ["Volcanism", "Diastrophism", "Weathering", "Erosion"],
            correct: 1,
            explanation:
              "Orogenic processes involving mountain building are one of the processes under diastrophism, along with epeirogeny, earthquakes and plate tectonics.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Epeirogeny, involving the uplift or warping of large parts of the earth's crust, is best described as a:",
            options: ["Mountain-building process", "Continental-building process", "Weathering process", "Erosional process"],
            correct: 1,
            explanation:
              "Orogeny is a mountain-building process, whereas epeirogeny is a continental-building process involving simple deformation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "All exogenic geomorphic processes — weathering, mass wasting, erosion and transportation — are covered under the general term:",
            options: ["Diastrophism", "Denudation", "Volcanism", "Isostasy"],
            correct: 1,
            explanation:
              "Denudation ('to strip off or uncover') is the general term covering weathering, mass wasting, erosion and transportation.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Weathering is defined as the mechanical disintegration and chemical decomposition of rocks, occurring:",
            options: [
              "Only after transportation of material",
              "In-situ, or on-site, with very little or no motion of materials",
              "Only in polar regions",
              "Only underwater",
            ],
            correct: 1,
            explanation:
              "Weathering is an in-situ or on-site process, as very little or no motion of materials takes place during weathering.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "A group of weathering processes including solution, carbonation, hydration, oxidation and reduction, which decompose or dissolve rocks through chemical reactions, are called:",
            options: ["Physical weathering processes", "Chemical weathering processes", "Biological weathering processes", "Mass wasting processes"],
            correct: 1,
            explanation:
              "Chemical weathering processes include solution, carbonation, hydration, oxidation and reduction.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The flaking off of curved sheets or shells from rocks, resulting in smooth and rounded surfaces, caused by expansion and contraction due to temperature changes, is called:",
            options: ["Exfoliation", "Carbonation", "Hydration", "Lithification"],
            correct: 0,
            explanation:
              "Exfoliation is the flaking off of curved sheets from over rocks, resulting in smooth and rounded surfaces, due to expansion and contraction.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Slipping of one or several units of rock debris with a backward rotation with respect to the slope over which movement takes place is called:",
            options: ["Debris slide", "Slump", "Rockslide", "Rockfall"],
            correct: 1,
            explanation:
              "Slump is the slipping of rock debris with a backward rotation with respect to the slope of movement.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT one of the five basic factors controlling soil formation?",
            options: ["Parent material", "Topography", "Climate", "Population density"],
            correct: 3,
            explanation:
              "The five basic soil-forming factors are parent material, topography, climate, biological activity and time — population density is not among them.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In humid equatorial climates with high rainfall, a major part of silica is removed from the soil through a process known as:",
            options: ["Eluviation", "Desilication", "Illuviation", "Calcification"],
            correct: 1,
            explanation:
              "Removal of silica from the soil in high rainfall equatorial climates is known as desilication.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In dry climates, where evaporation exceeds precipitation, groundwater brought to the surface by capillary action leaves behind salts forming a crust in the soil known as:",
            options: ["Kanker", "Hardpan", "Humus", "Loess"],
            correct: 1,
            explanation:
              "In dry climates, evaporating groundwater leaves behind salts that form a crust in the soil known as hardpans.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rhizobium, a type of bacteria living in the root nodules of leguminous plants, performs which important soil-related function?",
            options: ["Desilication", "Nitrogen fixation", "Humus decomposition", "Carbonation"],
            correct: 1,
            explanation:
              "Rhizobium bacteria live in root nodules of leguminous plants and fix nitrogen beneficial to the host plant.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which two soil-forming factors are described in the chapter as 'passive control factors', with their influence working mainly through exposure and drainage rather than direct chemical action?",
            options: ["Climate and biological activity", "Parent material and topography", "Time and climate", "Biological activity and time"],
            correct: 1,
            explanation:
              "Parent material and topography are described as passive control factors in soil formation.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which climatic elements are most important in controlling the processes of soil development?",
            options: ["Wind and pressure", "Moisture and temperature", "Humidity and cloud cover", "Insolation and latitude"],
            correct: 1,
            explanation:
              "The climatic elements involved in soil development are moisture (precipitation-evaporation, humidity) and temperature (seasonal and diurnal variations).",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "landforms-and-their-evolution",
        name: "Landforms and their Evolution",
        questions: [
          q({
            text: "A gorge, a deep valley with very steep to straight sides and nearly equal width at top and bottom, differs from a canyon mainly in that a canyon is:",
            options: ["Narrower at the top than the bottom", "Wider at the top than at the bottom", "Always deeper than a gorge", "Found only in limestone regions"],
            correct: 1,
            explanation:
              "A canyon is wider at its top than at its bottom, in contrast to a gorge which is almost equal in width at top and bottom.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Circular depressions formed on the rocky beds of hill-streams due to stream erosion aided by abrasion of rock fragments are called:",
            options: ["Plunge pools", "Potholes", "Meanders", "Terraces"],
            correct: 1,
            explanation:
              "Potholes are more or less circular depressions formed on rocky stream beds because of erosion aided by abrasion of rock fragments.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Deep and wide potholes found at the base of waterfalls, formed by the sheer impact of water and rotation of boulders, are called:",
            options: ["Potholes", "Plunge pools", "Oxbow lakes", "Cirques"],
            correct: 1,
            explanation:
              "Plunge pools are large and deep holes at the base of waterfalls, formed by the sheer impact of water and rotation of boulders.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Very deep and wide meanders cut into hard rocks, rather than in floodplains, are called:",
            options: ["Point bars", "Incised or entrenched meanders", "Natural levees", "River terraces"],
            correct: 1,
            explanation:
              "Incised or entrenched meanders are very deep and wide meanders found cut in hard rocks, unlike ordinary meandering courses on floodplains.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Surfaces marking old valley floor or floodplain levels, occurring at the same elevation on either side of a river, are called:",
            options: ["Natural levees", "Paired terraces", "Alluvial fans", "Deltas"],
            correct: 1,
            explanation:
              "River terraces occurring at the same elevation on either side of rivers are called paired terraces.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Broad, low to high cone-shaped deposits formed when streams flowing from higher levels break onto foot-slope plains of low gradient are called:",
            options: ["Deltas", "Alluvial fans", "Floodplains", "Point bars"],
            correct: 1,
            explanation:
              "Alluvial fans form when streams flowing from higher levels break into foot slope plains of low gradient, dumping their coarse load.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Low, linear and parallel ridges of coarse deposits found along the banks of large rivers are called:",
            options: ["Point bars", "Natural levees", "Meanders", "Terraces"],
            correct: 1,
            explanation:
              "Natural levees are low, linear and parallel ridges of coarse deposits found along the banks of large rivers.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Sediments deposited in a linear fashion on the concave side of meanders of large rivers are known as point bars, also called:",
            options: ["Natural levees", "Meander bars", "Oxbow lakes", "Alluvial fans"],
            correct: 1,
            explanation:
              "Point bars, found on the concave side of meanders, are also known as meander bars.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The topography developed by the action of groundwater through solution and deposition in limestone regions, named after a region in the Balkans, is called:",
            options: ["Peneplain", "Karst topography", "Pediplain", "Badland topography"],
            correct: 1,
            explanation:
              "Karst topography, named after the Karst region in the Balkans adjacent to the Adriatic Sea, is produced by groundwater action in limestone/dolomite rocks.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "An opening in limestone terrain, circular at the top and funnel-shaped towards the bottom, formed mainly through solution, is called a:",
            options: ["Doline", "Sinkhole", "Lapie", "Uvala"],
            correct: 1,
            explanation:
              "A sinkhole is an opening circular at the top and funnel-shaped towards the bottom, formed through solution in limestone terrain.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Long, narrow to wide trenches formed when sinkholes and dolines join together due to slumping or roof collapse are called:",
            options: ["Lapies", "Valley sinks or Uvalas", "Limestone pavements", "Swallow holes"],
            correct: 1,
            explanation:
              "Valley sinks or Uvalas are long, narrow to wide trenches formed when sinkholes and dolines join together.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Icicle-shaped deposits hanging from the roof of limestone caves are called stalactites, while similar formations rising from the cave floor are called:",
            options: ["Pillars", "Stalagmites", "Lapies", "Sinkholes"],
            correct: 1,
            explanation:
              "Stalagmites rise up from the floor of caves, formed due to dripping water from the stalactite immediately above.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Deep, long and wide troughs or basins with steep concave to vertically dropping walls, found at the heads of glacial valleys, are called:",
            options: ["Horns", "Cirques", "Drumlins", "Eskers"],
            correct: 1,
            explanation:
              "Cirques are deep, long and wide troughs or basins with steep walls, found at the heads of glacial valleys, and often contain tarn lakes.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "High, sharp-pointed and steep-sided peaks, such as the Matterhorn in the Alps and Mount Everest in the Himalayas, formed through headward erosion of radiating cirques, are called:",
            options: ["Arêtes", "Horns", "Drumlins", "Nunataks"],
            correct: 1,
            explanation:
              "Horns are high, sharp pointed peaks formed through headward erosion of three or more radiating cirques — Matterhorn and Everest are examples.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Very deep glacial troughs filled with sea water, forming shorelines in high latitudes, are called:",
            options: ["Cirques", "Fjords", "Eskers", "Drumlins"],
            correct: 1,
            explanation:
              "Fjords/fiords are very deep glacial troughs filled with sea water, forming shorelines in high latitudes.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Long ridges of deposits of glacial till found at the end (toe) of glaciers are called:",
            options: ["Lateral moraines", "Terminal moraines", "Medial moraines", "Ground moraines"],
            correct: 1,
            explanation:
              "Terminal moraines are long ridges of debris deposited at the end (toe) of glaciers.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Sinuous ridges of coarse material deposited by streams flowing beneath a glacier are called:",
            options: ["Drumlins", "Eskers", "Moraines", "Outwash plains"],
            correct: 1,
            explanation:
              "Eskers are sinuous ridges formed by coarse materials settling in the valley of ice streams flowing beneath a glacier.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Smooth, oval-shaped ridge-like features composed mainly of glacial till, with a blunter 'stoss' end facing the glacier and a tapering 'tail' end, that indicate the direction of glacier movement, are called:",
            options: ["Eskers", "Drumlins", "Moraines", "Cirques"],
            correct: 1,
            explanation:
              "Drumlins are smooth oval-shaped ridges of glacial till whose stoss and tail ends indicate the direction of glacier movement.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Along high rocky (submerged) coasts, constant wave pounding shapes hillsides into cliffs, leaving a flat platform in front of the sea cliff called a:",
            options: ["Wave-built terrace", "Wave-cut platform/terrace", "Continental shelf", "Barrier bar"],
            correct: 1,
            explanation:
              "A wave-cut terrace is a flat or gently sloping platform, above the average wave height, left in front of a receding sea cliff.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Resistant masses of rock, originally part of a cliff or hill, left standing isolated as small islands just off the shore, are called:",
            options: ["Sea arches", "Sea stacks", "Spits", "Bars"],
            correct: 1,
            explanation:
              "Sea stacks are resistant masses of rock, originally part of a cliff or hill, left standing isolated as small islands off the shore.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A barrier bar that gets keyed up to the headland of a bay, closing it off and eventually forming a lagoon, is called a:",
            options: ["Spit", "Beach", "Tombolo", "Sea cave"],
            correct: 0,
            explanation:
              "A barrier bar keyed up to the headland of a bay is called a spit.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the chapter, the west coast of India is a high rocky, retreating coast dominated by erosional forms, while the east coast is a:",
            options: [
              "High rocky coast dominated by erosional forms",
              "Low sedimentary coast dominated by depositional forms",
              "Coast with no significant landforms",
              "Coast dominated entirely by coral reefs",
            ],
            correct: 1,
            explanation:
              "The east coast of India is a low sedimentary coast, where depositional forms dominate, in contrast to the erosional west coast.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Gently inclined rocky floors close to the foot of mountains, formed through erosion by a combination of lateral stream erosion and sheet flooding, are called:",
            options: ["Playas", "Pediments", "Inselbergs", "Bajadas"],
            correct: 1,
            explanation:
              "Pediments are gently inclined rocky floors close to mountains at their foot, formed through lateral erosion and sheet flooding.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Shallow lakes found at the centre of desert basins, where water is retained only briefly due to evaporation and salts are deposited, are called:",
            options: ["Pediments", "Playas", "Inselbergs", "Oases"],
            correct: 1,
            explanation:
              "Playas are shallow lakes at the centre of desert basins where water is retained briefly, with playa plains covered in salts called alkali flats.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Crescent-shaped sand dunes with points directed downwind, forming where wind direction is constant and moderate, are called:",
            options: ["Seif dunes", "Barchans", "Parabolic dunes", "Longitudinal dunes"],
            correct: 1,
            explanation:
              "Barchans are crescent-shaped dunes with points directed downwind, forming where wind direction is constant and moderate.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "composition-and-structure-of-atmosphere",
        name: "Composition and Structure of Atmosphere",
        questions: [
          q({
            text: "About 99 per cent of the total mass of the atmosphere is confined to a height of how many km from the earth's surface?",
            options: ["10 km", "32 km", "50 km", "100 km"],
            correct: 1,
            explanation:
              "99 per cent of the total mass of the atmosphere is confined to the height of 32 km from the earth's surface.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which gas is transparent to incoming solar radiation but opaque to outgoing terrestrial radiation, making it largely responsible for the greenhouse effect?",
            options: ["Nitrogen", "Oxygen", "Carbon dioxide", "Argon"],
            correct: 2,
            explanation:
              "Carbon dioxide is transparent to incoming solar radiation but opaque to outgoing terrestrial radiation, making it largely responsible for the greenhouse effect.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Ozone, found between 10 and 50 km above the earth's surface, acts as a filter absorbing which type of radiation?",
            options: ["Infrared radiation", "Ultra-violet rays", "Visible light", "Radio waves"],
            correct: 1,
            explanation:
              "Ozone acts as a filter absorbing ultra-violet rays radiating from the sun, preventing them from reaching the earth's surface.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Water vapour in the atmosphere may account for up to about four per cent of air by volume in warm, wet tropics, but less than one per cent in:",
            options: ["Equatorial regions", "Dry and cold desert/polar regions", "Temperate coastal regions", "Monsoon regions"],
            correct: 1,
            explanation:
              "In the dry and cold areas of desert and polar regions, water vapour may be less than one per cent of the air.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Dust and salt particles act as hygroscopic nuclei, meaning they:",
            options: [
              "Repel water vapour",
              "Serve as centres around which water vapour condenses to form clouds",
              "Absorb oxygen from the air",
              "Have no role in cloud formation",
            ],
            correct: 1,
            explanation:
              "Dust and salt particles act as hygroscopic nuclei, absorbing water and serving as centres around which water vapour condenses to produce clouds.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The lowermost layer of the atmosphere, with an average height of 13 km and where nearly all weather phenomena occur, is called the:",
            options: ["Stratosphere", "Troposphere", "Mesosphere", "Thermosphere"],
            correct: 1,
            explanation:
              "The troposphere, the lowermost layer with an average height of 13 km, is where all climate and weather phenomena occur.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The troposphere is thickest at the equator (about 18 km) compared to the poles (about 8 km) mainly because:",
            options: [
              "There is less gravity at the equator",
              "Heat is transported to great heights by strong convectional currents at the equator",
              "The poles have more water vapour",
              "Ozone concentration is higher at the equator",
            ],
            correct: 1,
            explanation:
              "The troposphere's thickness is greatest at the equator because heat is transported to great heights by strong convectional currents there.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The zone separating the troposphere from the stratosphere, where temperature is nearly constant, is known as the:",
            options: ["Tropopause", "Stratopause", "Mesopause", "Ionosphere"],
            correct: 0,
            explanation:
              "The tropopause separates the troposphere from the stratosphere, with nearly constant temperature.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The stratosphere, extending up to a height of 50 km, contains which important protective layer?",
            options: ["The ionosphere", "The ozone layer", "The exosphere", "The troposphere"],
            correct: 1,
            explanation:
              "The stratosphere contains the ozone layer, which absorbs ultra-violet radiation and shields life on earth.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In the mesosphere, which extends up to 80 km, temperature decreases with increasing altitude, reaching as low as:",
            options: ["0°C", "Minus 45°C", "Minus 100°C", "Minus 273°C"],
            correct: 2,
            explanation:
              "In the mesosphere, temperature decreases with height, reaching about minus 100°C at 80 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The ionosphere, located between 80 and 400 km, contains electrically charged particles and is important because it:",
            options: [
              "Blocks all radio communication",
              "Reflects radio waves transmitted from the earth back to the earth",
              "Absorbs all incoming solar radiation",
              "Produces the aurora only",
            ],
            correct: 1,
            explanation:
              "The ionosphere reflects radio waves transmitted from the earth back to the earth, aiding radio communication.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The main elements of weather and climate, subject to change and influencing human life, include temperature, pressure, winds, humidity, clouds and:",
            options: ["Gravity", "Precipitation", "Magnetism", "Albedo"],
            correct: 1,
            explanation:
              "The main elements of weather and climate are temperature, pressure, winds, humidity, clouds and precipitation.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "solar-radiation-heat-balance-and-temperature",
        name: "Solar Radiation, Heat Balance and Temperature",
        questions: [
          q({
            text: "The energy received by the earth from the sun in short wavelengths is known as incoming solar radiation, or in short:",
            options: ["Albedo", "Insolation", "Terrestrial radiation", "Advection"],
            correct: 1,
            explanation:
              "Incoming solar radiation is termed insolation.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The earth is farthest from the sun (152 million km) on 4th July, a position called:",
            options: ["Perihelion", "Aphelion", "Equinox", "Solstice"],
            correct: 1,
            explanation:
              "Aphelion is the position on 4th July when the earth is farthest from the sun.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The earth is nearest to the sun (147 million km) on 3rd January, a position called:",
            options: ["Aphelion", "Perihelion", "Apogee", "Zenith"],
            correct: 1,
            explanation:
              "Perihelion is the position on 3rd January when the earth is nearest to the sun.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The earth's axis makes an angle of how many degrees with the plane of its orbit around the sun, greatly influencing the amount of insolation received at different latitudes?",
            options: ["23.5°", "66°", "90°", "45°"],
            correct: 1,
            explanation:
              "The earth's axis makes an angle of 66° with the plane of its orbit around the sun.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The insolation received at the earth's surface varies from about 320 Watt/m² in the tropics to about how much at the poles?",
            options: ["250 Watt/m²", "70 Watt/m²", "500 Watt/m²", "10 Watt/m²"],
            correct: 1,
            explanation:
              "Insolation received at the surface varies from about 320 Watt/m² in the tropics to about 70 Watt/m² at the poles.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The process by which heat is transferred from the earth's surface to the atmosphere near it through direct contact between unequal-temperature bodies is called:",
            options: ["Convection", "Conduction", "Advection", "Radiation"],
            correct: 1,
            explanation:
              "Conduction is heat transfer through direct contact, important in heating the lower layers of the atmosphere.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The process of vertical heating of the atmosphere, confined to the troposphere, in which heated air rises in currents, is called:",
            options: ["Conduction", "Convection", "Advection", "Terrestrial radiation"],
            correct: 1,
            explanation:
              "Convection is the vertical heating of the atmosphere through rising currents of heated air, confined to the troposphere.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The transfer of heat through horizontal movement of air, responsible for the local wind 'loo' in northern India during summer, is called:",
            options: ["Conduction", "Convection", "Advection", "Insolation"],
            correct: 2,
            explanation:
              "Advection is the transfer of heat through horizontal movement of air; the 'loo' in northern India is a result of advection.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the heat budget of the earth, of the 100 units of insolation received at the top of the atmosphere, approximately how many units are reflected back to space as the earth's albedo?",
            options: ["14 units", "35 units", "51 units", "65 units"],
            correct: 1,
            explanation:
              "About 35 units are reflected back to space before reaching the earth's surface (27 from clouds, 2 from snow/ice) — this reflected amount is called the earth's albedo.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The rate of decrease of temperature with height, known as the normal lapse rate, is approximately:",
            options: ["1°C per 1,000 m", "6.5°C per 1,000 m", "10°C per 1,000 m", "15°C per 1,000 m"],
            correct: 1,
            explanation:
              "The normal lapse rate, the rate of decrease of temperature with height, is 6.5°C per 1,000 m.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Lines on a map joining places having equal temperature are called:",
            options: ["Isobars", "Isotherms", "Isohyets", "Contours"],
            correct: 1,
            explanation:
              "Isotherms are lines joining places having equal temperature.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The highest range of temperature between January and July, more than 60°C, is found over which region, due to continentality?",
            options: ["The Sahara desert", "The north-eastern part of the Eurasian continent", "The Amazon Basin", "The Arctic Ocean"],
            correct: 1,
            explanation:
              "The highest range of temperature, more than 60°C, is found over the north-eastern part of the Eurasian continent, due to continentality.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A situation where the normal lapse rate is reversed, with temperature increasing with altitude instead of decreasing, is called:",
            options: ["Advection", "Inversion of temperature", "Convection", "Insolation"],
            correct: 1,
            explanation:
              "Inversion of temperature is when the normal lapse rate is reversed, and temperature increases with altitude.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Temperature inversion is favoured by a long winter night with clear skies and still air, and occurs normally throughout the year over:",
            options: ["Equatorial regions", "Polar areas", "Tropical deserts", "Coastal regions"],
            correct: 1,
            explanation:
              "Over polar areas, temperature inversion is normal throughout the year.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Cold air draining down hill and mountain slopes at night, piling up in valley bottoms under warmer air above (thus protecting plants from frost), is called:",
            options: ["Katabatic wind", "Air drainage", "Advection", "Föhn effect"],
            correct: 1,
            explanation:
              "Air drainage is the flow of cold, dense night air down slopes into valley bottoms, protecting plants from frost damage.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Compared to land, the sea heats up and cools down:",
            options: ["Faster than land", "Slower than land", "At the same rate as land", "In a manner unrelated to land"],
            correct: 1,
            explanation:
              "Compared to land, the sea gets heated slowly and loses heat slowly, so variation in temperature over the sea is less than over land.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Places located on the coast where warm ocean currents flow generally experience:",
            options: [
              "Lower temperatures than places on cold-current coasts",
              "Higher temperatures than places on cold-current coasts",
              "No temperature difference at all",
              "Only seasonal temperature variation",
            ],
            correct: 1,
            explanation:
              "Places on coasts where warm currents flow record higher temperature than places on coasts where cold currents flow.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which factor is described as having the greatest overall influence on a place's temperature, since it directly determines the amount of insolation received?",
            options: ["Altitude", "Latitude", "Distance from the sea", "Local aspects"],
            correct: 1,
            explanation:
              "Latitude, which determines insolation received, is the most fundamental factor controlling a place's temperature.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "atmospheric-circulation-and-weather-systems",
        name: "Atmospheric Circulation and Weather Systems",
        questions: [
          q({
            text: "The weight of a column of air contained in a unit area from mean sea level to the top of the atmosphere is called:",
            options: ["Wind velocity", "Atmospheric pressure", "Relative humidity", "Insolation"],
            correct: 1,
            explanation:
              "Atmospheric pressure is the weight of a column of air contained in a unit area from mean sea level to the top of the atmosphere.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "At sea level, the average atmospheric pressure is approximately:",
            options: ["500 millibars", "1,013.2 millibars", "1,500 millibars", "2,000 millibars"],
            correct: 1,
            explanation:
              "The average atmospheric pressure at sea level is 1,013.2 millibars.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Lines connecting places having equal atmospheric pressure, used to study horizontal pressure distribution, are called:",
            options: ["Isotherms", "Isobars", "Isohyets", "Contours"],
            correct: 1,
            explanation:
              "Isobars are lines connecting places having equal pressure.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Along 30°N and 30°S, high-pressure areas known as the subtropical highs are found, while near the equator, low pressure prevails, known as the:",
            options: ["Subpolar low", "Equatorial low", "Polar high", "Horse latitudes"],
            correct: 1,
            explanation:
              "Near the equator, the sea level pressure is low, known as the equatorial low.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The force exerted by the rotation of the earth, which deflects wind to the right in the Northern Hemisphere and to the left in the Southern Hemisphere, is called the:",
            options: ["Pressure gradient force", "Coriolis force", "Frictional force", "Centrifugal force"],
            correct: 1,
            explanation:
              "The Coriolis force, named after the French physicist who described it in 1844, deflects wind right in the Northern Hemisphere and left in the Southern Hemisphere.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Coriolis force is maximum at the poles and is completely absent at the:",
            options: ["Tropics", "Equator", "Mid-latitudes", "Arctic Circle"],
            correct: 1,
            explanation:
              "The Coriolis force is directly proportional to the angle of latitude, maximum at the poles and absent at the equator.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Wind blowing parallel to isobars, when the pressure gradient force is exactly balanced by the Coriolis force with no friction, is called the:",
            options: ["Geostrophic wind", "Katabatic wind", "Trade wind", "Local wind"],
            correct: 0,
            explanation:
              "This balanced wind, blowing parallel to isobars, is known as the geostrophic wind.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Northern Hemisphere, the wind circulation around a low-pressure system (cyclonic circulation) moves in which direction?",
            options: ["Clockwise", "Anticlockwise", "It does not rotate", "Alternating direction"],
            correct: 1,
            explanation:
              "In the Northern Hemisphere, cyclonic circulation (around a low) is anticlockwise, while anticyclonic circulation (around a high) is clockwise.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The zone near the equator where trade winds from both hemispheres converge and air rises due to high insolation, forming a low-pressure area, is called the:",
            options: ["Horse latitudes", "Inter Tropical Convergence Zone (ITCZ)", "Polar front", "Subtropical high"],
            correct: 1,
            explanation:
              "The Inter Tropical Convergence Zone (ITCZ) is where converging tropical winds rise due to high insolation and low pressure.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The tropical atmospheric circulation cell, involving rising air at the ITCZ and sinking air at about 30°N and S, is known as the:",
            options: ["Ferrel cell", "Hadley cell", "Polar cell", "Walker cell"],
            correct: 1,
            explanation:
              "The Hadley cell is the tropical circulation cell with rising air at the ITCZ and sinking air at about 30°N and S.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the middle latitudes, the atmospheric circulation cell involving surface westerlies is called the:",
            options: ["Hadley cell", "Ferrel cell", "Polar cell", "Trade cell"],
            correct: 1,
            explanation:
              "The Ferrel cell is the middle-latitude circulation cell, characterised by surface westerlies.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The appearance of unusually warm water off the coast of Peru, associated with pressure changes in the Central Pacific, is known as:",
            options: ["La Niña", "El Niño", "Southern Oscillation", "ENSO"],
            correct: 1,
            explanation:
              "El Niño is the appearance of warm water off the coast of Peru, replacing the cool Peruvian current.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The combined phenomenon of the Southern Oscillation and El Niño is known by which abbreviation?",
            options: ["ITCZ", "ENSO", "ITZ", "NAO"],
            correct: 1,
            explanation:
              "ENSO refers to the combined phenomenon of the Southern Oscillation and El Niño.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the day, air over the land heats up faster and rises, creating a pressure gradient that causes wind to blow from the sea towards the land; this is called the:",
            options: ["Land breeze", "Sea breeze", "Valley breeze", "Katabatic wind"],
            correct: 1,
            explanation:
              "During the day, the land heats up faster than the sea, and wind blows from the cooler sea towards the land — this is the sea breeze.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Cool air of high plateaus and ice fields draining down into a valley at night is called a:",
            options: ["Valley breeze", "Mountain wind", "Katabatic wind", "Foehn wind"],
            correct: 2,
            explanation:
              "Katabatic wind is the cool air of high plateaus and ice fields draining into the valley at night.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A large body of air with little horizontal variation in temperature and moisture, formed over a homogeneous surface, is called a(n):",
            options: ["Front", "Air mass", "Cyclone", "Isobar"],
            correct: 1,
            explanation:
              "An air mass is defined as a large body of air having little horizontal variation in temperature and moisture.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The boundary zone between two different air masses is called a front; when cold air moves towards a warm air mass, the contact zone is called a:",
            options: ["Warm front", "Cold front", "Occluded front", "Stationary front"],
            correct: 1,
            explanation:
              "When cold air moves towards the warm air mass, the contact zone is called the cold front.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Extra-tropical cyclones, forming along the polar front in the mid and high latitudes, differ from tropical cyclones in that they:",
            options: [
              "Have no frontal system and originate only over the sea",
              "Have a clear frontal system and can originate over both land and sea",
              "Move from east to west",
              "Are less destructive but longer lasting",
            ],
            correct: 1,
            explanation:
              "Extra tropical cyclones have a clear frontal system (absent in tropical cyclones), cover a larger area, and can originate over both land and sea.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A mature tropical cyclone is characterised by a region of calm subsiding air at its centre, called the:",
            options: ["Eye wall", "Eye", "Vortex", "Core"],
            correct: 1,
            explanation:
              "The eye is the region of calm subsiding air at the centre of a mature tropical cyclone.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which of the following conditions is NOT listed as favourable for the formation and intensification of tropical cyclones?",
            options: [
              "Sea surface temperature higher than 27°C",
              "Presence of the Coriolis force",
              "A pre-existing weak low-pressure area",
              "Strong vertical wind shear",
            ],
            correct: 3,
            explanation:
              "Small variations in vertical wind speed (i.e. weak wind shear), not strong vertical wind shear, favour tropical cyclone intensification.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "water-in-the-atmosphere",
        name: "Water in the Atmosphere",
        questions: [
          q({
            text: "Which of the following are recognised as core processes of the hydrological (water) cycle?",
            options: [
              "Evapotranspiration and condensation",
              "Sublimation and erosion",
              "Weathering and deposition",
              "Denudation and mass wasting",
            ],
            correct: 0,
            explanation: "The hydrological cycle involves evaporation and transpiration (together, evapotranspiration) of water into the atmosphere, followed by condensation into clouds and eventual precipitation.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The actual amount of water vapour present in the atmosphere, expressed in grams per cubic metre, is called:",
            options: ["Relative humidity", "Absolute humidity", "Specific humidity", "Saturation"],
            correct: 1,
            explanation:
              "Absolute humidity is the weight of water vapour per unit volume of air, expressed in grams per cubic metre.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The percentage of moisture present in the atmosphere compared to its full capacity at a given temperature is called:",
            options: ["Absolute humidity", "Relative humidity", "Dew point", "Latent heat"],
            correct: 1,
            explanation:
              "Relative humidity is the percentage of moisture present compared to full capacity at a given temperature.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The temperature at which saturation occurs in a given sample of air is known as the:",
            options: ["Latent heat of vaporisation", "Dew point", "Freezing point", "Condensation point"],
            correct: 1,
            explanation:
              "The dew point is the temperature at which saturation occurs in a given sample of air.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "When moisture directly condenses into solid form (skipping the liquid state), this process is known as:",
            options: ["Precipitation", "Sublimation", "Evaporation", "Condensation"],
            correct: 1,
            explanation:
              "Sublimation is when water vapour directly condenses into solid form.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Moisture deposited as water droplets on cooler surfaces like grass and stones, requiring a dew point above freezing point, is called:",
            options: ["Frost", "Dew", "Fog", "Mist"],
            correct: 1,
            explanation:
              "Dew forms when moisture is deposited as water droplets on cooler surfaces, requiring the dew point to be above the freezing point.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "When condensation takes place below freezing point, and excess moisture is deposited as minute ice crystals instead of water droplets, this is called:",
            options: ["Dew", "Frost", "Hail", "Sleet"],
            correct: 1,
            explanation:
              "Frost forms when condensation occurs below freezing point, with moisture deposited as minute ice crystals.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The main difference between mist and fog is that mist contains:",
            options: ["Less moisture than fog", "More moisture than fog", "No moisture at all", "Only smoke particles"],
            correct: 1,
            explanation:
              "Mist contains more moisture than fog, with each nuclei containing a thicker layer of moisture.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A condition when fog mixes with smoke, common in urban and industrial centres, is described as:",
            options: ["Haze", "Smog", "Mist", "Sleet"],
            correct: 1,
            explanation:
              "Smog is the condition when fog is mixed with smoke.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Thin, detached, feathery white clouds formed at high altitudes (8,000-12,000 m) are called:",
            options: ["Cumulus", "Cirrus", "Stratus", "Nimbus"],
            correct: 1,
            explanation:
              "Cirrus clouds, formed at high altitudes with a feathery appearance, are always white.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Clouds that look like cotton wool, generally formed at a height of 4,000-7,000 m with a flat base, are called:",
            options: ["Cirrus", "Cumulus", "Stratus", "Nimbus"],
            correct: 1,
            explanation:
              "Cumulus clouds look like cotton wool and are generally formed at 4,000-7,000 m with a flat base.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Layered clouds covering large portions of the sky, formed due to loss of heat or mixing of air masses of different temperatures, are called:",
            options: ["Cumulus", "Cirrus", "Stratus", "Nimbus"],
            correct: 2,
            explanation:
              "Stratus clouds are layered clouds covering large portions of the sky.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Black or dark grey, extremely dense clouds that are opaque to sunlight and often seem to touch the ground are called:",
            options: ["Cirrus", "Cumulus", "Stratus", "Nimbus"],
            correct: 3,
            explanation:
              "Nimbus clouds are black or dark grey, extremely dense and opaque to the sun's rays.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Frozen raindrops and refrozen melted snow-water, formed when a layer of air above freezing point overlies a subfreezing layer near the ground, is called:",
            options: ["Hail", "Sleet", "Frost", "Dew"],
            correct: 1,
            explanation:
              "Sleet is frozen raindrops and refrozen melted snow-water, forming under a specific layered temperature condition.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On the basis of origin, rainfall is classified into convectional, orographic (relief), and:",
            options: ["Frontal only", "Cyclonic or frontal", "Advectional", "Monsoonal"],
            correct: 1,
            explanation:
              "Rainfall is classified into convectional, orographic (relief), and cyclonic or frontal types on the basis of origin.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The area on the leeward side of a mountain, receiving little rainfall after the windward side has already received orographic rain, is known as the:",
            options: ["Convergence zone", "Rain-shadow area", "ITCZ", "Horse latitudes"],
            correct: 1,
            explanation:
              "The rain-shadow area is on the leeward side of a mountain, which remains dry after the windward side receives orographic rain.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In general, as one proceeds from the equator towards the poles, rainfall:",
            options: ["Increases steadily", "Decreases steadily", "Remains constant", "Fluctuates randomly"],
            correct: 1,
            explanation:
              "Rainfall goes on decreasing steadily as one proceeds from the equator towards the poles.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Between latitudes 35° and 40° N and S of the equator, rainfall is heavier on the eastern coasts and decreases towards the west, while between 45° and 65°, due to the westerlies, rainfall is heaviest on the:",
            options: ["Eastern margins of continents", "Western margins of continents", "Equatorial belt only", "Polar regions only"],
            correct: 1,
            explanation:
              "Between 45° and 65° N and S, due to the westerlies, rain is first received on the western margins of the continents and decreases eastward.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Areas receiving over 200 cm of rainfall per annum include the equatorial belt, windward slopes of mountains along western coasts in the cool temperate zone, and:",
            options: [
              "The interior of continents",
              "The coastal areas of monsoon lands",
              "The rain-shadow zones",
              "High latitude deserts",
            ],
            correct: 1,
            explanation:
              "The coastal areas of monsoon lands, along with the equatorial belt and windward mountain slopes in cool temperate zones, receive over 200 cm of rainfall annually.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "world-climate-and-climate-change",
        name: "World Climate and Climate Change",
        questions: [
          q({
            text: "The most widely used empirical classification of climate, based on mean annual and monthly temperature and precipitation, was developed by:",
            options: ["Alfred Wegener", "V. Koeppen", "Arthur Holmes", "Edwin Hubble"],
            correct: 1,
            explanation:
              "V. Koeppen developed the most widely used empirical climate classification scheme, based on temperature and precipitation data.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In Koeppen's classification, which capital letter denotes dry climates where potential evaporation exceeds precipitation?",
            options: ["A", "B", "C", "E"],
            correct: 1,
            explanation:
              "'B' denotes Dry Climates, where potential evaporation exceeds precipitation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Koeppen's system, Group A (Tropical) climates are characterised by an average temperature of the coldest month of:",
            options: ["Below minus 3°C", "18°C or higher", "Below 10°C for all months", "Exactly 0°C"],
            correct: 1,
            explanation:
              "Group A (Tropical) climates have an average temperature of the coldest month of 18°C or higher.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tropical wet climate (Af), found near the equator in areas like the Amazon Basin and western equatorial Africa, is characterised by:",
            options: [
              "A pronounced dry season and low annual rainfall",
              "No dry season, high uniform temperature and heavy rainfall throughout the year",
              "Cold winters and warm summers",
              "Extremely low humidity",
            ],
            correct: 1,
            explanation:
              "Tropical wet climate (Af) has no dry season, with high uniform temperature and heavy rainfall throughout the year.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tropical monsoon climate (Am), found over the Indian subcontinent, is characterised by heavy rainfall mostly in summer and a:",
            options: ["Wet winter", "Dry winter", "Cold winter with snow", "Uniform rainfall pattern"],
            correct: 1,
            explanation:
              "Tropical monsoon climate (Am) has heavy summer rainfall and a dry winter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mediterranean climate (Cs), found around the Mediterranean Sea and in areas like central California and central Chile, is characterised by:",
            options: [
              "Cold, wet summers and hot, dry winters",
              "Hot, dry summers and mild, rainy winters",
              "No seasonal variation at all",
              "Extremely high annual rainfall throughout",
            ],
            correct: 1,
            explanation:
              "Mediterranean climate (Cs) is characterised by hot, dry summers and mild, rainy winters.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The highest recorded shade temperature in the world, 58°C, was recorded at Al Aziziyah, Libya, in a region belonging to which Koeppen climate type?",
            options: ["Tropical wet (Af)", "Subtropical desert (BWh)", "Tundra (ET)", "Marine west coast (Cfb)"],
            correct: 1,
            explanation:
              "The highest shade temperature (58°C at Al Aziziyah, Libya, 1922) was recorded in a subtropical desert (BWh) climate region.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Tundra climate (ET), named after low-growing mosses, lichens and flowering plants, is a region characterised by permanently frozen subsoil known as:",
            options: ["Loess", "Permafrost", "Regolith", "Till"],
            correct: 1,
            explanation:
              "Tundra climate is the region of permafrost, where the subsoil is permanently frozen.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Ice cap climate (EF), occurring over interior Greenland and Antarctica, is characterised by temperatures that remain below freezing:",
            options: ["Only in winter", "Even in summer", "Only at night", "Only during storms"],
            correct: 1,
            explanation:
              "In ice cap climate, temperature remains below freezing point even in summer.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Highland climates (H) are primarily governed by which factor, causing large changes in mean temperature over short distances?",
            options: ["Latitude", "Topography (elevation)", "Ocean currents", "Wind belts"],
            correct: 1,
            explanation:
              "Highland climates are governed by topography, with large temperature changes occurring over short distances due to elevation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Archaeological findings suggest the Rajasthan desert experienced a wet and cool climate around which period?",
            options: ["8,000 B.C.", "3,000 B.C.", "1,700 B.C.", "500 A.D."],
            correct: 0,
            explanation:
              "Archaeological findings show that the Rajasthan desert experienced wet and cool climate around 8,000 B.C.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Europe witnessed the 'Little Ice Age' during approximately which period?",
            options: ["1000-1200 AD", "1550-1850 AD", "1900-1950 AD", "1700-1750 AD"],
            correct: 1,
            explanation:
              "Europe witnessed the 'Little Ice Age' from 1550 to about 1850.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Sunspots, dark and cooler patches on the sun that increase and decrease cyclically, are associated with which category of theory of climate change?",
            options: ["Terrestrial causes", "Astronomical causes", "Anthropogenic causes", "Volcanic causes"],
            correct: 1,
            explanation:
              "Sunspot activity is grouped under astronomical causes of climate change, related to changes in solar output.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Milankovitch oscillations refer to cycles in variations of the earth's orbital characteristics, wobbling, and:",
            options: ["Rotational speed only", "Changes in the earth's axial tilt", "Ocean current patterns", "Volcanic eruption frequency"],
            correct: 1,
            explanation:
              "Milankovitch oscillations infer cycles in the earth's orbital characteristics, wobbling, and changes in the earth's axial tilt.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Volcanic eruptions are considered a cause of climate change because they throw up aerosols into the atmosphere that:",
            options: [
              "Increase the sun's radiation reaching the earth",
              "Reduce the sun's radiation reaching the earth's surface for a considerable period",
              "Have no effect on climate",
              "Only affect local weather for a few hours",
            ],
            correct: 1,
            explanation:
              "Volcanic aerosols remain in the atmosphere for a considerable time, reducing the sun's radiation reaching the earth's surface.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The most important anthropogenic (human-caused) effect on climate is the increasing concentration of which category of gases in the atmosphere?",
            options: ["Noble gases", "Greenhouse gases", "Inert gases", "Halogen gases"],
            correct: 1,
            explanation:
              "The most important anthropogenic effect on climate is the increasing concentration of greenhouse gases, likely to cause global warming.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The largest concentration of greenhouse gases in the atmosphere, emitted mainly from fossil fuel combustion, is:",
            options: ["Methane", "Carbon dioxide", "Nitrous oxide", "Ozone"],
            correct: 1,
            explanation:
              "Carbon dioxide has the largest concentration among greenhouse gases, mainly from fossil fuel combustion.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Chlorofluorocarbons (CFCs), products of human activity that drift into the stratosphere and destroy ozone, are responsible for creating what is known as the:",
            options: ["Greenhouse effect", "Ozone hole", "Urban heat island", "El Niño effect"],
            correct: 1,
            explanation:
              "CFCs drifting into the stratosphere destroy ozone, causing the depletion known as the ozone hole, most pronounced over Antarctica.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The most important international effort to reduce greenhouse gas emissions, proclaimed in 1997 and effective from 2005, is known as the:",
            options: ["Montreal Protocol", "Kyoto Protocol", "Paris Agreement", "Rio Declaration"],
            correct: 1,
            explanation:
              "The Kyoto Protocol, proclaimed in 1997 and effective from 2005, bound 35 industrialised countries to reduce emissions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the chapter, the year considered the warmest of the 20th century (and possibly the whole millennium up to that point) was:",
            options: ["1990", "1998", "1940", "1977"],
            correct: 1,
            explanation:
              "The year 1998 was the warmest year, probably not only for the 20th century but for the whole millennium.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "water-oceans",
        name: "Water (Oceans)",
        questions: [
          q({
            text: "The earth is called the 'Blue Planet' because it has:",
            options: ["A blue-coloured atmosphere", "An abundant supply of water on its surface", "No solid landmass", "A blue magnetic field"],
            correct: 1,
            explanation:
              "The earth is called the 'Blue Planet' because, fortunately, it has an abundant supply of water on its surface.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "About 71 per cent of the planet's water is found in:",
            options: ["Glaciers and icecaps", "The oceans", "Groundwater", "The atmosphere"],
            correct: 1,
            explanation:
              "About 71 per cent of the planetary water is found in the oceans.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The ocean floor can be divided into four major divisions: the Continental Shelf, the Continental Slope, the Deep Sea Plain, and the:",
            options: ["Mid-oceanic ridge", "Oceanic Deeps (trenches)", "Continental rise", "Abyssal hills"],
            correct: 1,
            explanation:
              "The four major divisions of the ocean floor are the Continental Shelf, Continental Slope, Deep Sea Plain and Oceanic Deeps.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The continental shelf, the shallowest part of the ocean with an average gradient of 1° or less, has an average width of about:",
            options: ["20 km", "80 km", "200 km", "500 km"],
            correct: 1,
            explanation:
              "The average width of continental shelves is about 80 km.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Siberian shelf, the largest continental shelf in the world, stretches to a width of about:",
            options: ["500 km", "800 km", "1,500 km", "3,000 km"],
            correct: 2,
            explanation:
              "The Siberian shelf in the Arctic Ocean, the largest in the world, stretches to 1,500 km in width.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The continental slope, connecting the continental shelf and ocean basins, has a gradient varying between:",
            options: ["0.5-1°", "2-5°", "10-15°", "20-30°"],
            correct: 1,
            explanation:
              "The gradient of the continental slope region varies between 2-5°.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The deepest parts of the oceans, relatively steep-sided narrow basins associated with active volcanoes and strong earthquakes, are called:",
            options: ["Deep sea plains", "Oceanic deeps or trenches", "Continental shelves", "Guyots"],
            correct: 1,
            explanation:
              "Oceanic deeps or trenches are the deepest parts of the oceans, associated with active volcanoes and strong earthquakes.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Of the 57 oceanic deeps explored so far, the majority (32) are found in which ocean?",
            options: ["The Atlantic Ocean", "The Pacific Ocean", "The Indian Ocean", "The Arctic Ocean"],
            correct: 1,
            explanation:
              "Of the 57 explored oceanic deeps, 32 are in the Pacific Ocean, 19 in the Atlantic and 6 in the Indian Ocean.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A flat-topped seamount, showing evidence of gradual subsidence, is called a:",
            options: ["Atoll", "Guyot", "Trench", "Ridge"],
            correct: 1,
            explanation:
              "A guyot is a flat-topped seamount, showing evidence of gradual subsidence to become a flat-topped submerged mountain.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Low islands found in tropical oceans, consisting of coral reefs surrounding a central lagoon, are called:",
            options: ["Guyots", "Atolls", "Seamounts", "Shelves"],
            correct: 1,
            explanation:
              "Atolls are low islands found in tropical oceans, consisting of coral reefs surrounding a central depression or lagoon.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The average temperature of surface ocean water is about 27°C, and it decreases from the equator towards the poles at a rate of approximately:",
            options: ["0.1°C per latitude", "0.5°C per latitude", "2°C per latitude", "5°C per latitude"],
            correct: 1,
            explanation:
              "The rate of decrease of surface ocean temperature with increasing latitude is generally 0.5°C per latitude.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The boundary region in the ocean, usually beginning around 100-400 m below the surface, where there is a rapid decrease of temperature with depth, is called the:",
            options: ["Halocline", "Thermocline", "Pycnocline", "Mesopelagic zone"],
            correct: 1,
            explanation:
              "The thermocline is the boundary region where temperature decreases rapidly with depth, beginning around 100-400 m below the surface.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Salinity is defined as the amount of salt (in grams) dissolved in how much seawater?",
            options: ["100 grams", "1,000 grams (1 kg)", "1 litre", "1 million grams"],
            correct: 1,
            explanation:
              "Salinity is calculated as the amount of salt (in grams) dissolved in 1,000 grams (1 kg) of seawater.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following water bodies is cited as having the highest salinity, at 330 parts per thousand?",
            options: ["The Dead Sea", "The Great Salt Lake", "Lake Van in Turkey", "The Red Sea"],
            correct: 2,
            explanation:
              "Lake Van in Turkey has the highest salinity among water bodies mentioned, at 330 o/oo, ahead of the Dead Sea (238 o/oo) and Great Salt Lake (220 o/oo).",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The average salinity of the Atlantic Ocean is around 36 parts per thousand, while the highest salinity within it (37‰) is observed between:",
            options: ["0°-10° N", "20°N-30°N and 20°W-60°W", "60°-70° N", "At the equator only"],
            correct: 1,
            explanation:
              "The Atlantic Ocean's maximum salinity (37 o/oo) is observed between 20°N and 30°N, and 20°W-60°W.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Baltic Sea records low salinity mainly due to:",
            options: ["High evaporation", "Influx of large quantities of river water", "Enclosed location in low latitudes", "Cold ocean currents"],
            correct: 1,
            explanation:
              "The Baltic Sea records low salinity due to the influx of river waters in large quantity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Mediterranean Sea records higher salinity mainly due to:",
            options: ["Low evaporation", "High evaporation", "Large river inflows", "Melting polar ice"],
            correct: 1,
            explanation:
              "The Mediterranean Sea records higher salinity due to high evaporation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The zone in the ocean where salinity increases sharply with depth is called the:",
            options: ["Thermocline", "Halocline", "Pycnocline", "Mesocline"],
            correct: 1,
            explanation:
              "The halocline is the distinct zone where salinity increases sharply with depth.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "movements-of-ocean-water",
        name: "Movements of Ocean Water",
        questions: [
          q({
            text: "The horizontal motion of ocean water includes currents and waves, while the vertical motion refers mainly to:",
            options: ["Upwelling only", "Tides", "Currents", "Longshore drift"],
            correct: 1,
            explanation:
              "The vertical motion of ocean water refers to tides, while horizontal motion refers to ocean currents and waves.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Waves are actually a movement of:",
            options: ["Water itself travelling across the ocean", "Energy across the ocean surface", "Only wind", "Only sediment"],
            correct: 1,
            explanation:
              "Waves are the energy, not the water itself, that moves across the ocean surface; water particles only travel in a small circle as a wave passes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The vertical distance from the bottom of a trough to the top of a crest of a wave is called the:",
            options: ["Wave amplitude", "Wave height", "Wavelength", "Wave period"],
            correct: 1,
            explanation:
              "Wave height is the vertical distance from the bottom of a trough to the top of a crest.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The time interval between two successive wave crests or troughs passing a fixed point is called the:",
            options: ["Wave frequency", "Wave period", "Wave speed", "Wavelength"],
            correct: 1,
            explanation:
              "Wave period is the time interval between two successive wave crests or troughs as they pass a fixed point.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The periodical rise and fall of sea level, once or twice a day, mainly due to the gravitational attraction of the sun and moon, is called a:",
            options: ["Current", "Tide", "Wave", "Surge"],
            correct: 1,
            explanation:
              "A tide is the periodical rise and fall of the sea level, mainly due to the attraction of the sun and moon.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "When the sun, moon and earth are in a straight line (during full moon or new moon), resulting in the highest tides, these are called:",
            options: ["Neap tides", "Spring tides", "Diurnal tides", "Mixed tides"],
            correct: 1,
            explanation:
              "Spring tides occur when the sun, moon and earth are in a straight line, producing the highest tides.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "When the sun and moon are at right angles to each other, their gravitational forces partially cancel out, resulting in lower tides called:",
            options: ["Spring tides", "Neap tides", "Perigean tides", "Diurnal tides"],
            correct: 1,
            explanation:
              "Neap tides occur when the sun and moon are at right angles, with their forces tending to counteract each other.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The highest tides in the world, with a tidal bulge of 15-16 metres, occur in the:",
            options: ["Gulf of Kutch", "Bay of Fundy", "Bay of Bengal", "Gulf of Mexico"],
            correct: 1,
            explanation:
              "The highest tides in the world occur in the Bay of Fundy in Nova Scotia, Canada, with a tidal bulge of 15-16 m.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A tidal pattern featuring two high tides and two low tides of approximately equal height each day is called a:",
            options: ["Diurnal tide", "Semi-diurnal tide", "Mixed tide", "Neap tide"],
            correct: 1,
            explanation:
              "A semi-diurnal tide is the most common tidal pattern, featuring two high tides and two low tides of approximately equal height each day.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tides having variations in height, generally occurring along the west coast of North America and many Pacific islands, are called:",
            options: ["Semi-diurnal tides", "Diurnal tides", "Mixed tides", "Spring tides"],
            correct: 2,
            explanation:
              "Mixed tides, having variations in height, generally occur along the west coast of North America and Pacific islands.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The time between high tide and low tide, when the water level is falling, is called the:",
            options: ["Flow or flood", "Ebb", "Surge", "Slack tide"],
            correct: 1,
            explanation:
              "The ebb is the time between high tide and low tide, when the water level is falling.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Large accumulations of water and the flow around them, caused by the Coriolis force acting on wind-driven ocean currents, are called:",
            options: ["Thermoclines", "Gyres", "Eddies", "Upwellings"],
            correct: 1,
            explanation:
              "Gyres are large accumulations of water and the flow around them, producing large circular currents in ocean basins.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Warm ocean currents are usually found on the east coast of continents in low and middle latitudes, while cold currents are usually found on the:",
            options: [
              "East coast of continents in low latitudes",
              "West coast of continents in low and middle latitudes",
              "North Pole only",
              "Equator exclusively",
            ],
            correct: 1,
            explanation:
              "Cold currents are usually found on the west coast of continents in low and middle latitudes (in both hemispheres).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Gulf Stream, a warm current, raises the temperature near the eastern coast of North America and the west coast of Europe, while the Labrador Current (a cold current) lowers the temperature near the:",
            options: ["Western coast of Europe", "North-east coast of North America", "Equator", "Southern hemisphere coasts"],
            correct: 1,
            explanation:
              "The Labrador current (cold) lowers the temperature near the north-east coast of North America.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Areas where warm and cold ocean currents mix are significant because they:",
            options: [
              "Have no marine life",
              "Help replenish oxygen and favour plankton growth, creating the best fishing grounds",
              "Cause permanent fog with no benefits",
              "Are avoided entirely by fishing fleets",
            ],
            correct: 1,
            explanation:
              "The mixing of warm and cold currents helps replenish oxygen and favours plankton growth, and the best fishing grounds of the world exist mainly in these mixing zones.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "West coasts of continents in tropical and subtropical latitudes are typically bordered by cool waters, resulting in climates that are generally:",
            options: ["Warm and rainy", "Arid, with fog but low rainfall", "Extremely wet year-round", "Identical to east coast climates"],
            correct: 1,
            explanation:
              "West coasts in tropical/subtropical latitudes, bordered by cool waters, are generally arid with fog, despite relatively low average temperatures.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The primary forces that initiate ocean current movement include heating by solar energy, wind, gravity, and:",
            options: ["Magnetism", "The Coriolis force", "Volcanic activity", "Tidal locking"],
            correct: 1,
            explanation:
              "The primary forces influencing ocean currents are heating by solar energy, wind, gravity, and the Coriolis force.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Surface currents constitute about what percentage of all water in the ocean, occupying the upper 400 m?",
            options: ["5%", "10%", "50%", "90%"],
            correct: 1,
            explanation:
              "Surface currents constitute about 10 per cent of all the water in the ocean, in the upper 400 m.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "life-on-the-earth",
        name: "Life on the Earth",
        questions: [
          q({
            text: "The term 'ecology' was first used (as 'oekologie') in 1869 by which German zoologist?",
            options: ["Charles Darwin", "Ernst Haeckel", "Alexander Von Humboldt", "Alfred Wegener"],
            correct: 1,
            explanation:
              "Ernst Haeckel, a German zoologist, first used the term 'ecology' (as 'oekologie') in 1869.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A system consisting of biotic and abiotic components, all interrelated and interacting with each other, is known as a(n):",
            options: ["Biome", "Ecosystem", "Habitat", "Food web"],
            correct: 1,
            explanation:
              "An ecosystem is a system consisting of biotic and abiotic components, all interrelated and interacting.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "A biome is defined as a plant and animal community covering a large geographical area, with its boundaries determined mainly by:",
            options: ["Political borders", "Climate", "Human settlement patterns", "Ocean currents"],
            correct: 1,
            explanation:
              "A biome's boundaries on land are determined mainly by climate.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In an ecosystem, green plants that manufacture their own food through photosynthesis are called:",
            options: ["Primary consumers", "Producers", "Decomposers", "Top carnivores"],
            correct: 1,
            explanation:
              "Producers include all green plants, which manufacture their own food through photosynthesis.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Herbivorous animals like deer and goats, which feed directly on plants, are classified as:",
            options: ["Producers", "Primary consumers", "Secondary consumers", "Decomposers"],
            correct: 1,
            explanation:
              "Primary consumers include herbivorous animals like deer, goats and mice, which feed on producers.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Organisms like bacteria and fungi that feed on dead organisms and break down dead matter are called:",
            options: ["Producers", "Consumers", "Decomposers", "Top carnivores"],
            correct: 2,
            explanation:
              "Decomposers feed on dead organisms and further break down dead matter, changing it into nutrients essential for soil fertility.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The sequence of eating and being eaten, resulting in a transfer of energy from one level to another, is known as a:",
            options: ["Biome", "Food chain", "Biogeochemical cycle", "Habitat"],
            correct: 1,
            explanation:
              "The sequence of eating and being eaten, transferring energy from one level to the next, is a food chain.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "An interconnecting network of multiple, overlapping food chains is known as a:",
            options: ["Food web", "Trophic pyramid", "Ecosystem cycle", "Biome network"],
            correct: 0,
            explanation:
              "A food web is the interconnecting network of species formed when food-chains interlock with one another.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "A food chain that starts with plants as producers, moves through herbivores, and ends with carnivores as consumers is called a:",
            options: ["Detritus food chain", "Grazing food chain", "Decomposer chain", "Energy pyramid"],
            correct: 1,
            explanation:
              "A grazing food-chain starts with plants as producers, through herbivores at the intermediate level, ending with carnivores as consumers.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The cyclic movement of chemical elements of the biosphere between organisms and the environment is referred to as a:",
            options: ["Food chain", "Biogeochemical cycle", "Trophic level", "Ecological succession"],
            correct: 1,
            explanation:
              "Biogeochemical cycles are the cyclic movements of chemical elements between organisms and the environment.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the gaseous biogeochemical cycle, the main reservoir of nutrients is the atmosphere and the ocean, while in the sedimentary cycle, the main reservoir is:",
            options: ["The atmosphere only", "The soil and sedimentary rocks of the earth's crust", "The ocean only", "Living organisms only"],
            correct: 1,
            explanation:
              "In the sedimentary cycle, the main reservoir is the soil and sedimentary and other rocks of the earth's crust.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Only a very small fraction of total solar insolation reaching the earth's surface — about how much — is fixed in photosynthesis?",
            options: ["0.1%", "10%", "25%", "50%"],
            correct: 0,
            explanation:
              "Only a very small fraction (0.1 per cent) of total solar insolation is fixed in photosynthesis.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Nitrogen, comprising about 78 per cent of atmospheric gases, must first be 'fixed' before most organisms can use it; which agents are primarily responsible for biological nitrogen fixation?",
            options: ["Green plants directly", "Soil micro-organisms and associated plant roots", "Ocean currents", "Volcanic eruptions"],
            correct: 1,
            explanation:
              "Ninety per cent of fixed nitrogen is biological, with the principal source being the action of soil micro-organisms and associated plant roots.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The process by which certain bacteria convert nitrates back into free nitrogen, returning it to the atmosphere, is known as:",
            options: ["Nitrification", "Denitrification", "Ammonification", "Nitrogen fixation"],
            correct: 1,
            explanation:
              "Denitrification is the process of converting nitrates into free nitrogen by certain bacteria.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A state of dynamic equilibrium within a community of organisms in a habitat, where the diversity of living organisms remains relatively stable, is called:",
            options: ["Ecological succession", "Ecological balance", "Biogeochemical cycling", "Trophic stability"],
            correct: 1,
            explanation:
              "Ecological balance is a state of dynamic equilibrium within a community of organisms, where diversity remains relatively stable.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The change in species distribution following a disturbance (such as clearing forest for shifting cultivation), where secondary species like grasses or bamboo overtake native species, is called:",
            options: ["Ecological balance", "Succession", "Denitrification", "Biome shift"],
            correct: 1,
            explanation:
              "Succession is the change in species distribution after a disturbance, where secondary forest species overtake native species.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tropical grasslands are also known as:",
            options: ["Prairies", "Savannas", "Steppes", "Pampas"],
            correct: 1,
            explanation:
              "Tropical grasslands are also known as savannas.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the world biomes classification in the chapter, which biome type is characterised by multi-layered canopy, tall trees, and evenly distributed rainfall of around 1,000 mm, found within 10°N-S of the equator?",
            options: ["Temperate forest", "Equatorial forest", "Boreal forest", "Tundra"],
            correct: 1,
            explanation:
              "The equatorial forest biome (within 10°N-S) has a multi-layered canopy, tall trees, and evenly distributed rainfall around 1,000 mm.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "biodiversity-and-conservation",
        name: "Biodiversity and Conservation",
        questions: [
          q({
            text: "Biodiversity is a combination of two words, 'Bio' (life) and 'diversity', referring to the number and variety of organisms found within a:",
            options: ["Single species", "Specified geographic region", "Single ecosystem only", "Laboratory setting"],
            correct: 1,
            explanation:
              "Biodiversity refers to the number and variety of organisms found within a specified geographic region.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Biodiversity can be discussed at three levels: genetic diversity, species diversity, and:",
            options: ["Trophic diversity", "Ecosystem diversity", "Climatic diversity", "Habitat diversity"],
            correct: 1,
            explanation:
              "Biodiversity is discussed at three levels: genetic diversity, species diversity and ecosystem diversity.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Genetic diversity refers to the variation of genes within species, essential for:",
            options: ["Extinction of weak species", "Healthy breeding of populations of species", "Elimination of biodiversity", "Climate stability alone"],
            correct: 1,
            explanation:
              "Genetic diversity is essential for a healthy breeding population of species.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Areas particularly rich in species diversity are referred to as:",
            options: ["Biomes", "Hotspots of diversity", "Ecotones", "Habitats"],
            correct: 1,
            explanation:
              "Areas rich in species diversity are called hotspots of diversity.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the chapter, the average half-life of a species (the estimated time before extinction) is between:",
            options: ["100-500 years", "One and four million years", "10-50 million years", "1-2 billion years"],
            correct: 1,
            explanation:
              "The average half-life of a species is estimated at between one and four million years.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Tropical regions occupy only about one-fourth of the world's total area but contain about what fraction of the world's human population?",
            options: ["One-tenth", "Three-fourths", "Half", "One-fifth"],
            correct: 1,
            explanation:
              "Tropical regions, occupying about one-fourth of the world's area, contain about three-fourths of the world's human population.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Species that are not natural inhabitants of a local habitat but are introduced into the system, sometimes causing extensive damage to natural biotic communities, are called:",
            options: ["Endemic species", "Exotic species", "Keystone species", "Indicator species"],
            correct: 1,
            explanation:
              "Exotic species are those introduced into a system that are not natural inhabitants of the local habitat.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The International Union of Conservation of Nature and Natural Resources (IUCN) classifies threatened species into three categories: endangered, vulnerable, and:",
            options: ["Extinct", "Rare", "Invasive", "Domesticated"],
            correct: 1,
            explanation:
              "The IUCN classifies threatened species as endangered, vulnerable, and rare.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The IUCN publishes worldwide information about endangered species in a publication known as the:",
            options: ["Green Book", "Red List", "Blue Data Book", "White Paper"],
            correct: 1,
            explanation:
              "The IUCN publishes information about endangered species worldwide as the Red List of threatened species.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Species likely to be in danger of extinction in the near future if threatening factors continue, though not yet critically endangered, are classified as:",
            options: ["Endangered", "Vulnerable", "Rare", "Extinct"],
            correct: 1,
            explanation:
              "Vulnerable species are likely to be in danger of extinction in the near future if the threatening factors continue.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Species with very small populations, confined to limited areas or thinly scattered over a wide area, are classified by the IUCN as:",
            options: ["Endangered", "Vulnerable", "Rare", "Common"],
            correct: 2,
            explanation:
              "Rare species have very small populations, confined to limited areas or thinly scattered over a wider area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Government of India, along with 155 other nations, signed the Convention of Biodiversity at the Earth Summit held in Rio de Janeiro in:",
            options: ["1985", "1992", "1997", "2005"],
            correct: 1,
            explanation:
              "The Government of India, with 155 other nations, signed the Convention of Biodiversity at the Rio Earth Summit in June 1992.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "To protect, preserve and propagate species diversity, the Government of India passed which Act in 1972, leading to the establishment of national parks and sanctuaries?",
            options: ["The Forest Conservation Act", "The Wild Life (Protection) Act", "The Environment Protection Act", "The Biodiversity Act"],
            correct: 1,
            explanation:
              "The Wild Life (Protection) Act, 1972, led to the establishment of national parks and sanctuaries and declaration of biosphere reserves.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Countries possessing a large share of the world's species diversity, of which there are 12 including India, Brazil, Indonesia, China and Madagascar, are known as:",
            options: ["Endemic zones", "Mega diversity centres", "Biosphere reserves", "Ecological hotspots"],
            correct: 1,
            explanation:
              "There are 12 mega diversity centres in the world, including Mexico, Brazil, India, China, Indonesia and Madagascar.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Madagascar, a notable biodiversity hotspot, about what percentage of plants and animals are found nowhere else in the world?",
            options: ["25%", "50%", "85%", "100%"],
            correct: 2,
            explanation:
              "In Madagascar, about 85 per cent of the plants and animals are found nowhere else in the world.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Tropical rain forests, though occupying a relatively small area, are estimated to contain what share of the world's species?",
            options: ["10%", "25%", "50%", "90%"],
            correct: 2,
            explanation:
              "Tropical rain forests contain 50 per cent of the species on the earth, making their destruction disastrous for biodiversity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Biodiversity plays ecological, economic, and which other important role, helping us understand how life evolved and functions?",
            options: ["Political role", "Scientific role", "Religious role", "Administrative role"],
            correct: 1,
            explanation:
              "Biodiversity plays ecological, economic and scientific roles, helping us understand how life evolved and functions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "'Crop diversity', an important part of biodiversity that supplies food, pharmaceutical and cosmetic products to humankind, is also referred to as:",
            options: ["Genetic engineering", "Agro-biodiversity", "Species richness", "Ecosystem services"],
            correct: 1,
            explanation:
              "'Crop diversity', an important part of biodiversity, is also called agro-biodiversity.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "structure-and-physiography-of-india",
        name: "Structure and Physiography of India (Class 11)",
        questions: [
          q({
            text: "India can be divided into three broad geological divisions based on variations in geological structure: the Peninsular Block, the Himalayas and other Peninsular mountains, and the:",
            options: ["The Indian Desert", "Indo-Ganga-Brahmaputra Plain", "The Coastal Plains", "The Northeastern Plateau"],
            correct: 1,
            explanation: "The three broad geological divisions of India are the Peninsular Block, the Himalayas and other Peninsular mountains, and the Indo-Ganga-Brahmaputra Plain.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The northern boundary of the Peninsular Block runs as an irregular line from Kachchh along the western flank of the Aravalli Range near Delhi, roughly parallel to the Yamuna and the Ganga, as far as the:",
            options: ["Chotanagpur plateau", "Rajmahal hills and the Ganga delta", "Malwa plateau", "Meghalaya plateau"],
            correct: 1,
            explanation: "The Peninsular Block's northern boundary runs parallel to the Yamuna and Ganga as far as the Rajmahal hills and the Ganga delta.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Karbi Anglong and Meghalaya plateau in the northeast (separated from the Chotanagpur plateau by the Malda fault) and the desert areas of Rajasthan in the west are described in the chapter as:",
            options: ["Independent plates", "Extensions of the Peninsular Block", "Part of the Himalayan system", "Part of the Indo-Ganga plain"],
            correct: 1,
            explanation: "The Karbi Anglong-Meghalaya plateau and the Rajasthan desert areas are considered extensions of the Peninsular Block.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Peninsular Block has remained a rigid and stable landmass since the Cambrian period, except for which part, which is submerged beneath the sea?",
            options: ["Its entire eastern coast", "Some parts of its western coast", "Its entire coastline", "Only the Malabar backwaters"],
            correct: 1,
            explanation: "The Peninsular Block has been stable since the Cambrian period, except that parts of its western coast are submerged under the sea.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which type of mountain in the Peninsular Block, illustrated by the Narmada, Tapi and Mahanadi rift valleys, is formed due to vertical movements and block faulting?",
            options: ["Fold mountains", "Block mountains", "Volcanic mountains", "Residual mountains"],
            correct: 1,
            explanation: "Rift valleys of the Narmada, Tapi and Mahanadi were formed due to vertical movement and block faulting, producing block mountains.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Aravalli hills, Nallamala hills, Javadi hills, Veliconda hills and Mahendragiri hills are described in the chapter as examples of:",
            options: ["Fold mountains", "Relict or residual mountains", "Volcanic peaks", "Coastal ranges"],
            correct: 1,
            explanation: "These hills are examples of relict/residual mountains within the Peninsular Block.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Indo-Ganga-Brahmaputra Plain, the third geological division of India, was originally a geo-synclinal depression that attained its maximum development during the third phase of Himalayan formation, approximately:",
            options: ["6.4 million years ago", "64 million years ago", "640 million years ago", "6.4 billion years ago"],
            correct: 1,
            explanation: "The geo-synclinal depression forming the Indo-Ganga-Brahmaputra Plain attained maximum development about 64 million years ago.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The physical features of India are grouped into six physiographic divisions. Which of the following is NOT one of them?",
            options: ["The Northern Plain", "The Peninsular Plateau", "The Deccan Trap", "The Islands"],
            correct: 2,
            explanation: "The six physiographic divisions are the North & NE Mountains, Northern Plain, Peninsular Plateau, Indian Desert, Coastal Plains and Islands; 'the Deccan Trap' is not itself one of the six divisions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Along its longitudinal extent, the Himalayas can be divided into how many parallel ranges, including the Great Himalayas, the Trans-Himalayan range, the Middle Himalayas and the Shiwaliks?",
            options: ["Two", "Three", "Four", "Five"],
            correct: 2,
            explanation: "The Himalayas comprise four parallel ranges along their longitudinal extent.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The cold desert of Ladakh lies between the Great Himalayas and which range, drained by the Indus and its tributaries?",
            options: ["Pir Panjal range", "Karakoram range", "Zaskar range", "Shiwalik range"],
            correct: 1,
            explanation: "Ladakh, a cold desert, lies between the Great Himalayas and the Karakoram range.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Thick deposits of glacial clay and moraine found in the Kashmir Himalayas, useful for cultivating saffron (Zafran), are known as:",
            options: ["Duns", "Karewas", "Bugyals", "Duars"],
            correct: 1,
            explanation: "Karewas are thick glacial clay and moraine deposits in Kashmir, useful for saffron cultivation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Zoji La, an important pass on the Great Himalayas connecting Srinagar to Leh, is located in which sub-division of the Himalayas?",
            options: ["Himachal and Uttaranchal Himalayas", "Kashmir or Northwestern Himalayas", "Darjiling and Sikkim Himalayas", "Arunachal Himalayas"],
            correct: 1,
            explanation: "Zoji La is a pass located in the Kashmir (Northwestern) Himalayas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Himachal and Uttaranchal Himalayas lie approximately between the river Ravi in the west and which river, a tributary of the Ghaghara, in the east?",
            options: ["The Beas", "The Kali", "The Satluj", "The Yamuna"],
            correct: 1,
            explanation: "The Himachal and Uttaranchal Himalayas extend from the Ravi in the west to the Kali (a Ghaghara tributary) in the east.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The longitudinal valleys of the Himachal and Uttaranchal Himalayas, known as 'duns', include Chandigarh-Kalka dun, Nalagarh dun, and the largest of them all:",
            options: ["Kotli dun", "Dehra Dun", "Patli dun", "Harike dun"],
            correct: 1,
            explanation: "Dehra Dun is the largest of the longitudinal 'dun' valleys in this Himalayan sub-division.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Nomadic tribes who migrate to high-altitude summer grasslands known as 'Bugyals' and return to the valleys in winter, inhabiting the Great Himalayan range in Himachal and Uttaranchal, are called:",
            options: ["Lepchas", "Bhotias", "Monpas", "Nagas"],
            correct: 1,
            explanation: "Bhotia tribes migrate seasonally to 'Bugyals', the high-altitude summer grasslands.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Darjiling and Sikkim Himalayas, flanked by the Nepal Himalayas in the west and the Bhutan Himalayas in the east, are drained by which fast-flowing river?",
            options: ["The Tista", "The Subansiri", "The Kameng", "The Dihang"],
            correct: 0,
            explanation: "The Tista is the fast-flowing river draining the Darjiling and Sikkim Himalayas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Unlike the Himachal and Kashmir Himalayas, the Darjiling and Sikkim Himalayas lack Shiwalik formations, having instead which alternative formation used for tea gardens?",
            options: ["Bugyals", "Duars", "Karewas", "Terai"],
            correct: 1,
            explanation: "'Duars' are the alternative formation, used for tea gardens, found in place of Shiwaliks/duns in Darjiling-Sikkim.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Arunachal Himalayas, the Brahmaputra flows through a deep gorge after crossing which prominent peak?",
            options: ["Kangtu", "Namcha Barwa", "Kanchenjunga", "Nanda Devi"],
            correct: 1,
            explanation: "The Brahmaputra passes through a deep gorge after crossing Namcha Barwa.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tribal communities of the Arunachal Himalayas, including the Monpa, Daffla, Abor, Mishmi, Nishi and Nagas, mostly practise which form of cultivation?",
            options: ["Terrace farming", "Jhumming (shifting cultivation)", "Plantation farming", "Commercial farming"],
            correct: 1,
            explanation: "These tribal communities mostly practise Jhumming, or shifting/slash-and-burn cultivation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Eastern Hills and Mountains, running north to south, are locally known (from north to south) as the Patkai Bum, Naga hills, Manipur hills, and:",
            options: ["Khasi hills", "Mizo or Lushai hills", "Garo hills", "Jaintia hills"],
            correct: 1,
            explanation: "From north to south, the Eastern Hills include the Patkai Bum, Naga hills, Manipur hills and Mizo (Lushai) hills.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Loktak Lake, a large lake surrounded by mountains on all sides, is a distinctive feature of which region?",
            options: ["Nagaland", "Manipur", "Mizoram", "Meghalaya"],
            correct: 1,
            explanation: "Loktak Lake is a large lake located in Manipur.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The narrow belt of the Northern Plains lying parallel to the Shiwalik foothills, about 8-10 km wide, where streams from the mountains disappear underground, is called the:",
            options: ["Bhangar", "Bhabar", "Khadar", "Terai"],
            correct: 1,
            explanation: "The Bhabar belt is the narrow zone at the break of slope where streams disappear.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "South of the Bhabar belt, streams and rivers re-emerge without a well-demarcated channel, creating a wet, swampy region known as the:",
            options: ["Bhabar", "Terai", "Bhangar", "Khadar"],
            correct: 1,
            explanation: "South of Bhabar lies the Terai, a marshy belt where streams re-emerge.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Majuli, the largest riverine island in India, and a distinctive feature of periodic floods and shifting river courses, lies within the plains of the:",
            options: ["The Ganga", "The Brahmaputra", "The Indus", "The Yamuna"],
            correct: 1,
            explanation: "Majuli is a large riverine island in the Brahmaputra plains, known for periodic floods and shifting courses.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Peninsular Plateau can be divided into three broad groups on the basis of prominent relief features: the Deccan Plateau, the Northeastern Plateau, and the:",
            options: ["Malwa Plateau", "Central Highlands", "Chotanagpur Plateau", "Karnataka Plateau"],
            correct: 1,
            explanation: "The Peninsular Plateau is divided into the Deccan Plateau, Central Highlands and Northeastern Plateau.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Peninsular Plateau, the Western Ghats are known locally as the Sahyadri in Maharashtra, and by which name in Karnataka and Tamil Nadu?",
            options: ["Cardamom hills", "Nilgiri hills", "Anaimalai hills", "Palni hills"],
            correct: 1,
            explanation: "In Karnataka and Tamil Nadu, the Western Ghats are locally called the Nilgiri hills.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Anaimudi (2,695 m), the highest peak of the Peninsular plateau, is located on the Anaimalai hills of the Western Ghats, followed by Dodabetta (2,637 m) on the:",
            options: ["Cardamom hills", "Nilgiri hills", "Palni hills", "Shevaroy hills"],
            correct: 1,
            explanation: "Dodabetta, the second highest peak, is located on the Nilgiri hills.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Meghalaya plateau, believed to have been detached from the main Peninsular Block due to the northeastward movement of the Indian plate during Himalayan formation, is separated from the Chotanagpur plateau by the:",
            options: ["Bhima fault", "Malda fault", "Narmada fault", "Son fault"],
            correct: 1,
            explanation: "The Malda fault in West Bengal separates the Meghalaya plateau from the Chotanagpur plateau.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Meghalaya plateau is further sub-divided into the Garo Hills (west), Khasi Hills (central) and which hills (east), named after tribal groups?",
            options: ["Naga Hills", "Jaintia Hills", "Mizo Hills", "Patkai Hills"],
            correct: 1,
            explanation: "The eastern sub-division of the Meghalaya plateau is the Jaintia Hills.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Great Indian Desert, an undulating landscape with longitudinal dunes and barchans, receiving less than 150 mm of annual rainfall, is also known as:",
            options: ["Bhangar", "Marusthali", "Karewa", "Duar"],
            correct: 1,
            explanation: "The Great Indian Desert is also called Marusthali.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Wood fossils found near Aakal and marine deposits near Brahmasar (Jaisalmer), estimated to be about 180 million years old, suggest that the Indian desert region was once:",
            options: ["A dense forest", "Under the sea, during the Mesozoic era", "A glacial region", "A volcanic plateau"],
            correct: 1,
            explanation: "These fossils suggest the region was submerged under the sea during the Mesozoic era.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which coastal plain of India is described as an example of a submerged coast, believed to have once included the ancient city of Dwaraka?",
            options: ["The eastern coastal plain", "The western coastal plain", "The Coromandel coast", "The Northern Circars"],
            correct: 1,
            explanation: "The western coastal plain is a submerged coast, believed to have included the ancient city of Dwaraka.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The backwaters of the Malabar coast, used for fishing, inland navigation and tourism (and famous for the Nehru Trophy Vallamkali boat race at Punnamada), are called:",
            options: ["Duars", "Kayals", "Karewas", "Bugyals"],
            correct: 1,
            explanation: "Kayals are the backwaters of the Malabar coast, used for fishing and tourism.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The two principal groups of the Andaman and Nicobar Islands are separated by a water body called the:",
            options: ["Eleven Degree Channel", "Ten Degree Channel", "Palk Strait", "Gulf of Mannar"],
            correct: 1,
            explanation: "The Ten Degree Channel separates the Andaman group from the Nicobar group.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's only active volcano is located on which island of the Andaman and Nicobar group?",
            options: ["Great Nicobar", "Barren Island", "Ritchie's Archipelago", "Labrynth Island"],
            correct: 1,
            explanation: "Barren Island, in the Nicobar group, hosts India's only active volcano.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Lakshadweep and Minicoy islands, built up of coral deposits and divided by the Eleven Degree Channel, lie off which coast of India?",
            options: ["Tamil Nadu coast", "Kerala coast", "Odisha coast", "Gujarat coast"],
            correct: 1,
            explanation: "Lakshadweep and Minicoy lie off the Kerala coast, at a distance of 280-480 km.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "drainage-system-of-india-class11",
        name: "Drainage System of India (Class 11)",
        questions: [
          q({
            text: "The boundary line separating one drainage basin from another is known as a:",
            options: ["Catchment area", "Water divide or watershed", "Drainage pattern", "Delta"],
            correct: 1,
            explanation: "A water divide (watershed) is the boundary line separating one drainage basin from another.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The drainage pattern resembling the branches of a tree, exemplified by the rivers of the northern plains, is known as:",
            options: ["Radial", "Trellis", "Dendritic", "Centripetal"],
            correct: 2,
            explanation: "A dendritic pattern resembles tree branches and is seen in the rivers of the northern plains.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "When rivers originate from a hill and flow outward in all directions, as with rivers originating from the Amarkantak range, the drainage pattern is called:",
            options: ["Dendritic", "Radial", "Trellis", "Centripetal"],
            correct: 1,
            explanation: "A radial pattern occurs when rivers flow outward in all directions from a central hill.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "When the primary tributaries of rivers flow parallel to each other and secondary tributaries join them at right angles, the resulting drainage pattern is known as:",
            options: ["Dendritic", "Radial", "Trellis", "Centripetal"],
            correct: 2,
            explanation: "A trellis pattern forms when parallel primary tributaries are joined by tributaries at right angles.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "When rivers discharge their waters from all directions into a lake or depression, the drainage pattern is known as:",
            options: ["Dendritic", "Radial", "Trellis", "Centripetal"],
            correct: 3,
            explanation: "A centripetal pattern occurs when rivers converge from all directions into a lake or depression.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On the basis of orientation to the sea, Indian drainage is classified into the Arabian Sea drainage and the Bay of Bengal drainage; nearly what percentage of the drainage area is oriented towards the Bay of Bengal?",
            options: ["23%", "50%", "77%", "90%"],
            correct: 2,
            explanation: "About 77% of India's drainage area is oriented towards the Bay of Bengal.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Narmada and the Tapi are exceptions among Peninsular rivers since, despite originating in the Peninsular uplands, they discharge their waters into the:",
            options: ["Bay of Bengal", "Arabian Sea", "Indian Ocean directly", "Ganga"],
            correct: 1,
            explanation: "The Narmada and Tapi are Peninsular rivers that flow west into the Arabian Sea instead of the Bay of Bengal.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "It is believed that a mighty river once traversed the entire longitudinal extent of the Himalaya, from Assam to Punjab and Sind, known as the:",
            options: ["Tsangpo", "Indo-Brahma (Shiwalik) river", "Sarda river", "Panjnad river"],
            correct: 1,
            explanation: "The ancient Indo-Brahma (Shiwalik) river is believed to have flowed across the entire Himalayan longitudinal extent.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The dismemberment of the ancient Indo-Brahma river during the Pleistocene period was probably due to the uplift of the western Himalayas, including which plateau/ridge, which acted as a water divide between the Indus and Ganga drainage systems?",
            options: ["The Malwa plateau", "The Potwar Plateau (Delhi Ridge)", "The Chotanagpur plateau", "The Deccan plateau"],
            correct: 1,
            explanation: "Uplift of the Potwar Plateau (Delhi Ridge) created a water divide between the Indus and Ganga systems.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The downthrusting of the Malda gap area between the Rajmahal hills and the Meghalaya plateau during the mid-Pleistocene period diverted the Ganga and Brahmaputra systems to flow towards the:",
            options: ["Arabian Sea", "Bay of Bengal", "Indian Ocean directly", "Persian Gulf"],
            correct: 1,
            explanation: "The Malda gap downthrusting diverted the Ganga and Brahmaputra to flow towards the Bay of Bengal.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Indus, one of the largest river basins in the world, originates from a glacier near Bokhar Chu in the Kailash mountain range, in Tibet, where it is known as:",
            options: ["Sindhu", "Singi Khamban ('Lion's mouth')", "Tsangpo", "Panjnad"],
            correct: 1,
            explanation: "In Tibet, the Indus is known as 'Singi Khamban', meaning Lion's mouth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The five rivers of Punjab — the Satluj, Beas, Ravi, Chenab and Jhelum — join together just above Mithankot to form what is known as the:",
            options: ["Sindhu", "Panjnad", "Doab", "Tsangpo"],
            correct: 1,
            explanation: "These five rivers unite to form the Panjnad just above Mithankot before joining the Indus.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Yamuna, the westernmost and longest tributary of the Ganga, rises from the Yamunotri Glacier and joins the Ganga at:",
            options: ["Haridwar", "Prayag (Allahabad)", "Varanasi", "Patna"],
            correct: 1,
            explanation: "The Yamuna joins the Ganga at Prayag (Allahabad).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Chambal, an important right-bank tributary of the Yamuna rising near Mhow in the Malwa plateau, is well known for its distinctive badland topography, locally called:",
            options: ["Duns", "Ravines", "Karewas", "Bhabar"],
            correct: 1,
            explanation: "The Chambal is known for its ravine (badland) topography.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The river Kosi, notorious for frequently changing its course and causing severe floods, is popularly known as the:",
            options: ["'Sorrow of Bengal'", "'Sorrow of Bihar'", "'Sorrow of Punjab'", "'Sorrow of Assam'"],
            correct: 1,
            explanation: "The Kosi is popularly called the 'Sorrow of Bihar' due to its devastating floods.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Damodar river, which occupies the eastern margin of the Chotanagpur Plateau and was once nicknamed the 'sorrow of Bengal', has since been tamed by the multipurpose project of the:",
            options: ["Bhakra Nangal Corporation", "Damodar Valley Corporation", "Hirakud Corporation", "Narmada Valley Corporation"],
            correct: 1,
            explanation: "The Damodar Valley Corporation was established to control the Damodar's floods.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Brahmaputra, one of the largest rivers in the world, is known as the 'Tsangpo' (meaning 'purifier') while flowing through:",
            options: ["Arunachal Pradesh", "Tibet", "Assam", "Bangladesh"],
            correct: 1,
            explanation: "In Tibet, the Brahmaputra is known as the Tsangpo.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Bangladesh, after being joined by the Tista, the Brahmaputra is known by which name before merging with the Padma?",
            options: ["Meghna", "Jamuna", "Surma", "Dhaleswari"],
            correct: 1,
            explanation: "After the Tista joins it, the Brahmaputra is known as the Jamuna in Bangladesh.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The evolution of Peninsular drainage involved three major geological events, including the subsidence of the western flank of the Peninsula in the early tertiary period (causing submergence of the west coast) and:",
            options: [
              "The complete disappearance of the Peninsular plateau",
              "The upheaval of the Himalayas causing trough faulting on the northern flank of the Peninsular block",
              "The formation of the Thar desert",
              "The merging of the Indus and Ganga systems",
            ],
            correct: 1,
            explanation: "One of the three events was the upheaval of the Himalayas, causing trough faulting on the northern flank of the Peninsular block.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The slight tilting of the Peninsular block from northwest to southeast gave the entire Peninsular drainage system (except the Narmada and Tapi) a general orientation towards the:",
            options: ["Arabian Sea", "Bay of Bengal", "Indian Ocean", "Persian Gulf"],
            correct: 1,
            explanation: "The NW-SE tilt oriented most Peninsular rivers towards the Bay of Bengal.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Godavari, the largest Peninsular river system, is also known as the:",
            options: ["Uttar Ganga", "Dakshin Ganga", "Purva Ganga", "Paschim Ganga"],
            correct: 1,
            explanation: "The Godavari is also called the 'Dakshin Ganga' (Ganga of the South).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Kaveri river, which receives rainfall from both the southwest summer monsoon and the northeast winter monsoon, is notable among Peninsular rivers for having:",
            options: [
              "No water throughout the year",
              "Comparatively less fluctuation in its flow throughout the year",
              "The largest catchment area in India",
              "A completely dry riverbed in winter",
            ],
            correct: 1,
            explanation: "Because it receives both monsoons, the Kaveri has comparatively steady flow throughout the year.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Narmada river originates from the Amarkantak plateau and flows through a rift valley between the Vindhyan range (north) and which range (south)?",
            options: ["Aravalli range", "Satpura range", "Sahyadri range", "Maikal range"],
            correct: 1,
            explanation: "The Narmada flows through a rift valley between the Vindhyan range and the Satpura range.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Tapi, the second major west-flowing river of the Peninsula, originates in the Betul district of Madhya Pradesh, with the majority of its drainage area (about 79 per cent) lying in:",
            options: ["Madhya Pradesh", "Maharashtra", "Gujarat", "Chhattisgarh"],
            correct: 1,
            explanation: "About 79% of the Tapi's drainage basin lies within Maharashtra.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is listed among the significant problems affecting the usability of Indian river water, alongside pollution and uneven seasonal flow?",
            options: [
              "Excess availability of water everywhere",
              "River water disputes between states",
              "Complete absence of silt in rivers",
              "Overly deep river channels",
            ],
            correct: 1,
            explanation: "River water disputes between states are cited as a major problem in the usability of India's river water.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "climate-of-india-class11",
        name: "Climate of India (Class 11)",
        questions: [
          q({
            text: "The Tropic of Cancer passes through the middle of India, with the southern part of the country lying in the:",
            options: ["Temperate zone", "Tropical zone", "Polar zone", "Arid zone"],
            correct: 1,
            explanation: "The area south of the Tropic of Cancer lies in the tropical zone.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Compared to interior areas, coastal areas of India have an equable climate mainly because:",
            options: [
              "They receive no rainfall",
              "Large water bodies exert a moderating influence on temperature",
              "They are closer to the Tropic of Cancer",
              "They lie in the rain-shadow zone",
            ],
            correct: 1,
            explanation: "Proximity to large water bodies has a moderating effect on coastal temperatures.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The high-pressure centre that develops during winter to the north of the Himalayas causes cold, dry continental winds to blow towards:",
            options: ["Central Asia", "The Indian subcontinent", "The Arabian Sea", "Southeast Asia"],
            correct: 1,
            explanation: "In winter, cold dry continental winds from the north blow towards the Indian subcontinent.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The western jet stream, blowing at an altitude of 9-13 km from west to east, gets bifurcated by which mountain barrier?",
            options: ["The Aravallis", "The Tibetan highlands", "The Western Ghats", "The Vindhyas"],
            correct: 1,
            explanation: "The Tibetan highlands bifurcate the western jet stream into northern and southern branches.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The southern branch of the western jet stream, with its mean position at about 25°N in February, exercises an important influence on:",
            options: ["The summer monsoon onset", "The winter weather of India", "The formation of cyclones only", "Ocean currents"],
            correct: 1,
            explanation: "The southern branch of the western jet stream influences India's winter weather.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Western cyclonic disturbances, which enter India from the west and northwest during winter months, originate over the Mediterranean Sea and:",
            options: ["The Bay of Bengal", "Western Asia", "The Arabian Sea", "The Pacific Ocean"],
            correct: 1,
            explanation: "Western cyclonic disturbances originate over the Mediterranean Sea and Western Asia.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The winter rainfall brought by western cyclonic disturbances, though meagre, is highly beneficial for which crops?",
            options: ["Kharif crops", "Rabi crops", "Zaid crops", "Plantation crops"],
            correct: 1,
            explanation: "Winter rain from western disturbances benefits Rabi crops.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "By mid-July, an elongated low-pressure area termed the Inter Tropical Convergence Zone (ITCZ) sets in near the surface over:",
            options: ["Southern peninsula", "The northern plains (Ganga Plain)", "The Arabian Sea", "The Bay of Bengal only"],
            correct: 1,
            explanation: "By mid-July, the ITCZ sets in over the northern plains (Ganga Plain).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "An easterly jet stream, which flows over peninsular India at about 15°N in June, is believed to have interrelationship with:",
            options: [
              "The formation of western disturbances only",
              "The northward shift of the ITCZ and withdrawal of the westerly jet stream",
              "Winter fog in northern India",
              "The formation of the Thar desert",
            ],
            correct: 1,
            explanation: "The easterly jet stream's onset is linked to the northward shift of the ITCZ and the withdrawal of the westerly jet stream.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "El Niño, a weather phenomenon involving the appearance of warm currents off the coast of Peru, appears once every how many years, bringing drought, floods and weather extremes globally?",
            options: ["Every year", "Three to seven years", "Ten to fifteen years", "Twenty-five years"],
            correct: 1,
            explanation: "El Niño typically recurs every 3-7 years.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the traditional Indian calendar, the six two-monthly seasons include Vasanta, Grishma, Varsha, Sharada, Hemanta and:",
            options: ["Vaisakha", "Shishira", "Chaitra", "Ashadha"],
            correct: 1,
            explanation: "The sixth traditional season is Shishira (winter).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "December and January, the coldest months in the northern plains during the cold weather season, see mean daily temperatures remaining below:",
            options: ["10°C", "21°C", "30°C", "35°C"],
            correct: 1,
            explanation: "Mean daily temperatures in the northern plains stay below 21°C in December-January.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The 'loo', a strong, hot, dry wind blowing in the afternoon (sometimes till midnight) during the hot weather season, is common in which regions?",
            options: [
              "Kerala and Karnataka coast",
              "Punjab, Haryana, Rajasthan and Uttar Pradesh",
              "West Bengal and Assam",
              "Jammu and Kashmir",
            ],
            correct: 1,
            explanation: "The 'loo' is a common hot dry wind of Punjab, Haryana, Rajasthan and Uttar Pradesh in summer.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Pre-monsoon showers common in Kerala and coastal Karnataka, which help in the early ripening of mangoes, are called:",
            options: ["Nor'westers", "Mango showers", "Blossom showers", "Kalbaisakhi"],
            correct: 1,
            explanation: "'Mango showers' are pre-monsoon showers that help ripen mangoes in Kerala and Karnataka.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Dreaded local evening thunderstorms of West Bengal and Assam during the hot weather season, whose name derives from the calamity of the month of Baisakh, are called:",
            options: ["Mango showers", "Nor'westers ('Kalbaisakhi')", "Blossom showers", "Loo"],
            correct: 1,
            explanation: "Nor'westers, locally called 'Kalbaisakhi', are dreaded evening thunderstorms of Bengal and Assam.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Assam, the local evening thunderstorms of the hot weather season are known as:",
            options: ["Kalbaisakhi", "Bardoli Chheerha", "Mango showers", "Loo"],
            correct: 1,
            explanation: "In Assam these thunderstorms are known as 'Bardoli Chheerha'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Southwest Monsoon enters India through two branches — the Bay of Bengal branch and the:",
            options: ["Andaman Sea branch", "Arabian Sea branch", "Persian Gulf branch", "Indian Ocean branch"],
            correct: 1,
            explanation: "The two branches of the southwest monsoon are the Arabian Sea branch and the Bay of Bengal branch.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "One branch of the Arabian Sea monsoon winds is obstructed by the Western Ghats; the windward side (Sahyadris and western coastal plain) receives very heavy rainfall of about:",
            options: ["50-100 cm", "100-150 cm", "250-400 cm", "500-600 cm"],
            correct: 2,
            explanation: "The windward side of the Western Ghats receives about 250-400 cm of rainfall from this monsoon branch.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The area on the leeward (eastern) side of the Western Ghats that receives little rainfall from the Arabian Sea branch of the monsoon, such as around Pune and Bangalore, is known as the:",
            options: ["ITCZ", "Rain-shadow area", "Monsoon trough", "Coriolis zone"],
            correct: 1,
            explanation: "This dry leeward zone is called the rain-shadow area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mawsynram, located on the crest of the Khasi hills in Meghalaya and fed by the Bay of Bengal branch of the monsoon, receives:",
            options: [
              "No rainfall at all",
              "The highest average annual rainfall in the world",
              "Only winter snowfall",
              "Rainfall only from cyclones",
            ],
            correct: 1,
            explanation: "Mawsynram receives the highest average annual rainfall in the world.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Tamil Nadu coast remains comparatively dry during the southwest monsoon season mainly because it lies parallel to the Bay of Bengal branch and in the rain-shadow area of:",
            options: ["The Bay of Bengal branch", "The Arabian Sea branch of the monsoon", "The Himalayan drainage", "The northeast monsoon"],
            correct: 1,
            explanation: "Tamil Nadu lies in the rain-shadow of the Arabian Sea branch of the southwest monsoon.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The rainfall received from the southwest monsoon accounts for about what fraction of the country's total annual precipitation, received during the June-September period?",
            options: ["One-third", "Half", "Three-fourths", "Nine-tenths"],
            correct: 2,
            explanation: "About three-fourths of India's total annual rainfall is received in the southwest monsoon season.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The 'breaks' in the monsoon, related to the movement of the axis of the monsoon trough of low pressure, are associated with the frequency and intensity of tropical depressions forming at the head of the:",
            options: ["Arabian Sea", "Bay of Bengal", "Andaman Sea", "Persian Gulf"],
            correct: 1,
            explanation: "Monsoon breaks are linked to depressions forming at the head of the Bay of Bengal.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "During the retreating monsoon season (October-November), the oppressive weather caused by high temperature and humidity in northern India is commonly known as:",
            options: ["Loo", "October heat", "Kalbaisakhi", "Nor'wester"],
            correct: 1,
            explanation: "This oppressive weather is commonly called 'October heat'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the retreating monsoon, cyclonic depressions originating over the Andaman Sea and crossing the eastern coast bring destructive tropical cyclones, with the thickly populated deltas of the Godavari, Krishna and Kaveri frequently being:",
            options: ["Spared from these cyclones", "Preferred targets of these cyclones", "Only affected in winter", "Unaffected due to their inland location"],
            correct: 1,
            explanation: "These densely populated deltas are frequently the preferred targets of retreating-monsoon cyclones.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The average annual rainfall of India is about:",
            options: ["50 cm", "125 cm", "250 cm", "400 cm"],
            correct: 1,
            explanation: "India's average annual rainfall is about 125 cm.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Areas of high rainfall variability (more than 50%), such as western Rajasthan and the interior Deccan plateau, are also areas that typically receive:",
            options: [
              "Very high annual rainfall (over 200 cm)",
              "Low annual rainfall (less than 50 cm)",
              "Moderate annual rainfall (100-150 cm)",
              "Only snowfall",
            ],
            correct: 1,
            explanation: "Regions with high rainfall variability, like western Rajasthan, typically also receive low annual rainfall.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "According to Koeppen's classification adopted for India, the 'Aw' type climate (tropical wet and dry) is found in north-western Gujarat, some parts of western Rajasthan and:",
            options: ["Kerala", "Punjab", "Tamil Nadu", "Arunachal Pradesh"],
            correct: 1,
            explanation: "The 'Aw' climate type also covers some parts of Punjab.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "natural-vegetation-of-india-class11",
        name: "Natural Vegetation of India (Class 11)",
        questions: [
          q({
            text: "Tropical Evergreen Forests, found on the western slope of the Western Ghats, the hills of the northeastern region and the Andaman & Nicobar Islands, occur in areas with an annual precipitation of over:",
            options: ["100 cm", "150 cm", "200 cm", "300 cm"],
            correct: 2,
            explanation: "Tropical evergreen forests occur in areas with over 200 cm of annual precipitation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Semi-evergreen forests, found in less rainy parts of the evergreen regions, are a mixture of evergreen and moist deciduous trees, with which feature providing them an evergreen character?",
            options: ["Orchids", "Undergrowth climbers", "Grasses", "Mosses"],
            correct: 1,
            explanation: "Undergrowth climbers give semi-evergreen forests their evergreen character.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tropical Deciduous Forests, the most widespread forests of India, are also called monsoon forests because they occur in regions receiving rainfall between:",
            options: ["50-70 cm", "70-200 cm", "200-300 cm", "Over 300 cm"],
            correct: 1,
            explanation: "Tropical deciduous forests are found in regions with rainfall between 70-200 cm.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Moist deciduous forests, found along the foothills of the Himalayas and in Odisha with rainfall between 100-200 cm, have which trees as their main species?",
            options: ["Babool and khejri", "Teak, sal, shisham and mahua", "Cactus and acacia", "Chir pine and deodar"],
            correct: 1,
            explanation: "Teak, sal, shisham and mahua are the main species of moist deciduous forests.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Dry deciduous forests, covering vast areas of the country with rainfall between 70-100 cm, form a transition zone between moist deciduous forests and:",
            options: ["Montane forests", "Thorn forests", "Littoral forests", "Mangrove forests"],
            correct: 1,
            explanation: "Dry deciduous forests transition into thorn forests in drier margins.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tropical Thorn Forests, found in the semi-arid areas of Punjab, Haryana, Rajasthan, Gujarat, Madhya Pradesh and Uttar Pradesh, occur in areas receiving rainfall of less than:",
            options: ["30 cm", "50 cm", "70 cm", "100 cm"],
            correct: 1,
            explanation: "Tropical thorn forests occur in areas with less than 50 cm of rainfall.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Himalayan (northern) mountain forests, wet temperate forests with predominant oak and chestnut trees are found between an altitude of:",
            options: ["500-1,000 m", "1,000-2,000 m", "3,000-4,000 m", "Above 4,000 m"],
            correct: 1,
            explanation: "Wet temperate forests with oak and chestnut occur between 1,000-2,000 m in the Himalayas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Chir pine, a very useful commercial tree, is well developed in the Himalayan montane forest zone between altitudes of:",
            options: ["500-1,000 m", "1,500-1,750 m", "2,500-3,000 m", "4,000-4,500 m"],
            correct: 1,
            explanation: "Chir pine forests are well developed between 1,500-1,750 m.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Alpine pastures at altitudes of 3,000-4,000 m in the Himalayas are used extensively for transhumance by tribes such as the Gujjars, Bakarwals, Bhotiyas and:",
            options: ["Bhils", "Gaddis", "Santhals", "Todas"],
            correct: 1,
            explanation: "Gaddi tribes also practise transhumance using these alpine pastures.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The temperate forests of the southern mountain regions of the Peninsula (Western Ghats, Nilgiris, Anaimalai and Palani hills) are locally known as:",
            options: ["Duars", "Sholas", "Karewas", "Bugyals"],
            correct: 1,
            explanation: "These temperate forests of the southern hills are locally called 'Sholas'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's wetlands, covering about 3.9 million hectares, include Chilika Lake and Keoladeo National Park, both protected as waterfowl habitats under the:",
            options: ["Kyoto Protocol", "Convention on Wetlands of International Importance (Ramsar Convention)", "Man and Biosphere Programme", "Wildlife Protection Act"],
            correct: 1,
            explanation: "These sites are protected under the Ramsar Convention on Wetlands of International Importance.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's mangrove forests, spread over about 6,740 sq km, account for about what share of the world's mangrove forests?",
            options: ["1%", "7%", "25%", "50%"],
            correct: 1,
            explanation: "India's mangroves account for about 7% of the world's total.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to state records, forest area covers about what percentage of the total land area of the country (a figure that differs from the actual forest cover recorded by satellite imagery)?",
            options: ["12.60%", "20.55%", "23.28%", "33%"],
            correct: 2,
            explanation: "State records show forest area covering about 23.28% of India's land area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Union Territory has zero recorded forest area, while the Andaman and Nicobar Islands have the highest, at 86.93%?",
            options: ["Chandigarh", "Lakshadweep", "Puducherry", "Delhi"],
            correct: 1,
            explanation: "Lakshadweep has zero recorded forest area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The National Forest Policy (1952, modified in 1988) aimed at bringing what percentage of India's geographical area under forest cover?",
            options: ["20%", "25%", "33%", "50%"],
            correct: 2,
            explanation: "The National Forest Policy aimed at bringing 33% of the geographical area under forest cover.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the National Commission on Agriculture (1976), social forestry is classified into three categories: Urban forestry, Farm forestry, and:",
            options: ["Community forestry", "Rural forestry", "Commercial forestry", "Plantation forestry"],
            correct: 1,
            explanation: "The three categories are Urban forestry, Rural forestry and Farm forestry.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Agro-forestry, which combines agriculture with forestry to simultaneously produce food, fodder, fuel, timber and fruit, is promoted under which category of social forestry?",
            options: ["Urban forestry", "Rural forestry", "Farm forestry", "None of these"],
            correct: 1,
            explanation: "Agro-forestry is emphasised under rural forestry.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Project Tiger, launched in 1973, initially began with nine tiger reserves, which increased to how many reserves distributed across 17 states?",
            options: ["17", "27", "40", "92"],
            correct: 1,
            explanation: "Project Tiger expanded from nine to 27 tiger reserves across 17 states.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Project Elephant, launched in 1992 to assist states with free-ranging populations of wild elephants, has been implemented in how many states?",
            options: ["5", "9", "13", "20"],
            correct: 2,
            explanation: "Project Elephant has been implemented in 13 states.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A Biosphere Reserve, recognised within the framework of UNESCO's Man and Biosphere (MAB) Programme, aims at achieving three objectives: conservation, development, and:",
            options: ["Tourism", "Logistics (research and monitoring network)", "Agriculture", "Urbanisation"],
            correct: 1,
            explanation: "The three objectives are conservation, development and logistics (research and monitoring).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Nilgiri Biosphere Reserve, the first of India's biosphere reserves (established in September 1986), possesses the largest known population of which two endangered animal species?",
            options: [
              "Asiatic lion and blackbuck",
              "Nilgiri Tahr and Lion-tailed macaque",
              "Snow leopard and red panda",
              "One-horned rhinoceros and wild buffalo",
            ],
            correct: 1,
            explanation: "The Nilgiri Biosphere Reserve has the largest known population of the Nilgiri Tahr and Lion-tailed macaque.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Sunderbans Biosphere Reserve, located in the swampy delta of the river Ganga in West Bengal, is home to nearly how many Royal Bengal Tigers?",
            options: ["50", "100", "200", "500"],
            correct: 2,
            explanation: "The Sunderbans is home to nearly 200 Royal Bengal Tigers.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "soils-of-india",
        name: "Soils of India (Class 11)",
        questions: [
          q({
            text: "In ancient India, soils were classified into two main groups — Urvara and Usara — which were respectively:",
            options: ["Sterile and fertile", "Fertile and sterile", "Sandy and clayey", "Red and black"],
            correct: 1,
            explanation: "Urvara meant fertile soil, and Usara meant sterile soil.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the 16th century A.D., soils were classified on the basis of their inherent characteristics and external features such as texture, colour, slope of land and:",
            options: ["Age of formation", "Moisture content in the soil", "Mineral wealth", "Vegetation type only"],
            correct: 1,
            explanation: "Moisture content was one of the features used in 16th-century soil classification.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The topmost layer of the soil profile, where organic materials get incorporated with mineral matter necessary for plant growth, is called:",
            options: ["Horizon A", "Horizon B", "Horizon C", "Bedrock"],
            correct: 0,
            explanation: "Horizon A is the topmost layer with organic matter incorporated into mineral matter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "'Horizon C', the layer that represents the first stage in the soil formation process and eventually forms the layers above it, is composed of:",
            options: ["Fully weathered mature soil", "Loose parent material", "Solid bedrock only", "Pure humus"],
            correct: 1,
            explanation: "Horizon C consists of loose parent material, the initial stage of soil formation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the classification adopted by the Indian Council of Agricultural Research (ICAR), based on the USDA Soil Taxonomy, which soil order covers the largest area of India (about 40 per cent)?",
            options: ["Entisols", "Inceptisols", "Alfisols", "Vertisols"],
            correct: 1,
            explanation: "Inceptisols cover the largest share, about 40%, of India's area under this classification.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "On the basis of genesis, colour, composition and location, the soils of India are classified into eight types, including Alluvial, Black, Red and Yellow, Laterite, Arid, Saline, Peaty and:",
            options: ["Sandy soils", "Forest soils", "Rocky soils", "Clay soils"],
            correct: 1,
            explanation: "Forest soils are the eighth type in this classification.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Alluvial soils, widespread in the northern plains and river valleys, cover about what percentage of the total area of the country?",
            options: ["20%", "30%", "40%", "60%"],
            correct: 2,
            explanation: "Alluvial soils cover about 40% of India's total area.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Ganga plain, two types of alluvial soils have developed: Khadar, the newer alluvium deposited by floods, and:",
            options: ["Regur", "Bhangar (older alluvium containing kankar)", "Usara", "Terai soil"],
            correct: 1,
            explanation: "Bhangar is the older alluvium containing calcareous concretions (kankar).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Black soil, which covers most of the Deccan Plateau and is also known as 'Regur soil' or 'Black Cotton Soil', develops wide cracks in the dry season, a phenomenon called:",
            options: ["Leaching", "'Self ploughing'", "Salinization", "Podzolisation"],
            correct: 1,
            explanation: "Black soils develop cracks through 'self ploughing' during the dry season.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Chemically, black soils are rich in lime, iron, magnesia and alumina, but they lack:",
            options: ["Clay content", "Phosphorous, nitrogen and organic matter", "Moisture retention capacity", "Potash"],
            correct: 1,
            explanation: "Black soils lack phosphorous, nitrogen and organic matter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Red soil develops a reddish colour due to the diffusion of iron in crystalline and metamorphic rocks, and looks yellow when it occurs in:",
            options: ["A dehydrated form", "A hydrated form", "An oxidised form", "A saline form"],
            correct: 1,
            explanation: "Red soil appears yellow when the iron compound occurs in a hydrated form.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The word 'Laterite' is derived from the Latin word 'Later', which means:",
            options: ["Red", "Brick", "Clay", "Hard"],
            correct: 1,
            explanation: "'Later' is Latin for 'brick'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Laterite soils, though poor in organic matter, nitrogen, phosphate and calcium, are commonly cut into bricks for house construction and are found mainly in the higher areas of:",
            options: ["The northern plains", "The Peninsular plateau", "The Indian desert", "The Himalayan foothills"],
            correct: 1,
            explanation: "Laterite soils develop mainly in the higher areas of the Peninsular plateau.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Arid soils are generally sandy in structure and saline in nature; their lower horizons are occupied by kankar layers due to increasing calcium content downwards, which restricts:",
            options: ["Nitrogen fixation", "The infiltration of water", "Wind erosion", "Salt formation"],
            correct: 1,
            explanation: "The kankar layer restricts water infiltration in arid soils.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Saline soils, also known as 'Usara' soils, contain a larger proportion of sodium, potassium and magnesium, making them infertile; farmers in such areas are advised to use which substance to solve the salinity problem?",
            options: ["Lime", "Gypsum", "Urea", "Potash"],
            correct: 1,
            explanation: "Gypsum is recommended to counter soil salinity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Peaty soils, found in areas of heavy rainfall and high humidity, contain organic matter that may go up to:",
            options: ["10-15%", "20-25%", "40-50%", "70-80%"],
            correct: 2,
            explanation: "Organic matter in peaty soils may reach 40-50%.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Forest soils, found in mountainous areas with sufficient rainfall, are loamy and silty on valley sides but become coarse-grained on:",
            options: ["The plains", "The upper slopes", "The riverbeds", "The deltas"],
            correct: 1,
            explanation: "Forest soils become coarse-grained on the upper slopes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Sheet erosion, a type of water erosion where soil is removed in a layer over a large area after a heavy shower, is distinguished from gully erosion mainly because sheet erosion is:",
            options: ["More visible and noticeable", "Not easily noticeable", "Restricted only to hilly areas", "Caused only by wind"],
            correct: 1,
            explanation: "Sheet erosion is not easily noticeable, unlike gully erosion.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Deep gullies or ravines, which make agricultural land unfit for cultivation, are widespread in the Chambal basin, as well as in Tamil Nadu and:",
            options: ["Punjab", "West Bengal", "Kerala", "Rajasthan"],
            correct: 1,
            explanation: "Ravines are also widespread in West Bengal.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India is estimated to lose about how many hectares of land to ravines every year?",
            options: ["800 hectares", "8,000 hectares", "80,000 hectares", "800,000 hectares"],
            correct: 1,
            explanation: "India loses about 8,000 hectares of land to ravines annually.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT listed as a remedial measure to reduce soil erosion?",
            options: [
              "Contour bunding and terracing",
              "Controlled grazing and cover cropping",
              "Excessive and unregulated irrigation",
              "Regulated forestry and crop rotation",
            ],
            correct: 2,
            explanation: "Excessive, unregulated irrigation is a cause of soil degradation, not a remedy.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Experiments to stabilise sand dunes in western Rajasthan have been carried out by the:",
            options: [
              "Indian Council of Agricultural Research (ICAR) alone",
              "Central Arid Zone Research Institute (CAZRI)",
              "Soil Survey of India",
              "National Bureau of Soil Survey",
            ],
            correct: 1,
            explanation: "The Central Arid Zone Research Institute (CAZRI) has conducted sand dune stabilisation experiments.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "natural-hazards-and-disasters-india",
        name: "Natural Hazards and Disasters in India (Class 11)",
        questions: [
          q({
            text: "A weak tropical cyclone with sustained wind speeds too low to be classified as a full cyclonic storm is known as a:",
            options: ["Tropical depression", "Tornado", "Anticyclone", "Blizzard"],
            correct: 0,
            explanation: "A tropical depression is the weakest stage of a tropical cyclone system, with wind speeds below the threshold for a cyclonic storm; a tornado is a distinct, much smaller-scale rotating windstorm, not a category of tropical cyclone.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Palmer Drought Severity Index is a widely used indicator for measuring which type of natural hazard?",
            options: ["Drought", "Flood", "Earthquake", "Cyclone"],
            correct: 0,
            explanation: "The Palmer Drought Severity Index (PDSI) uses temperature and precipitation data to estimate relative dryness and is a standard tool for measuring drought severity.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Bhopal Gas Tragedy of 1984, involving the leak of methyl isocyanate gas from a pesticide plant, is classified as which type of disaster?",
            options: ["Chemical disaster", "Nuclear disaster", "Biological disaster", "Geological disaster"],
            correct: 0,
            explanation: "The Bhopal Gas Tragedy resulted from the accidental leak of a toxic chemical (methyl isocyanate) from an industrial plant, making it a classic example of a man-made chemical disaster.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Flooding of alluvial rivers is often worsened by which combination of factors?",
            options: [
              "Meandering river courses, deforestation, and faulty agricultural practices",
              "Only high-altitude snowfall",
              "Only urbanisation along the coast",
              "Only reduced river discharge",
            ],
            correct: 0,
            explanation: "Flooding along alluvial rivers is aggravated by a combination of factors: meandering courses that slow drainage, deforestation in catchment areas that increases runoff, and faulty agricultural practices that reduce soil's water-absorbing capacity.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "According to the chapter, a 'disaster' is best defined as an undesirable occurrence resulting from forces largely outside human control, which:",
            options: [
              "Always provides ample advance warning",
              "Strikes with little or no warning and causes serious disruption of life or property",
              "Occurs only due to human negligence",
              "Never requires emergency mobilisation of resources",
            ],
            correct: 1,
            explanation: "A disaster strikes quickly with little or no warning and causes serious disruption of life or property.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "'Natural Hazards' are described as elements of circumstance in the natural environment with the potential to cause harm to people or property; these may be swift, like earthquakes, or permanent, like:",
            options: [
              "A single cyclone event",
              "Unstable structural features in the Himalayas or extreme climatic conditions in deserts",
              "A single flood event",
              "A single landslide",
            ],
            correct: 1,
            explanation: "Permanent hazards include features like unstable Himalayan structures or extreme desert climate.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Bhopal Gas Tragedy and the Chernobyl nuclear disaster are examples cited in the chapter of disasters caused primarily by:",
            options: ["Natural forces", "Human activities", "Ocean currents", "Solar radiation"],
            correct: 1,
            explanation: "These disasters were caused primarily by human activities, not natural forces.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The International Decade for Natural Disaster Reduction (IDNDR), declared by the UN General Assembly in 1989, was formalised at the World Conference on Disaster Management in May 1994 in:",
            options: ["Kobe", "Yokohama", "Geneva", "Bhopal"],
            correct: 1,
            explanation: "This conference in Yokohama, Japan, produced the 'Yokohama Strategy and Plan of Action for a Safer World'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the chapter's classification of natural disasters into four categories, floods, tidal waves, ocean currents and tsunami fall under which category?",
            options: ["Atmospheric", "Terrestrial", "Aquatic", "Biological"],
            correct: 2,
            explanation: "Floods, tidal waves, ocean currents and tsunamis are classed as aquatic disasters.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Earthquakes, volcanic eruptions, landslides and avalanches fall under which category of natural disasters?",
            options: ["Atmospheric", "Terrestrial", "Aquatic", "Biological"],
            correct: 1,
            explanation: "These are classed as terrestrial disasters.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the table of major natural disasters since 1948 cited in the chapter, which single event caused the highest number of deaths (about 700,000)?",
            options: [
              "The 1970 East Pakistan Tropical Cyclone",
              "The 1976 China Earthquake",
              "The 2004 Indonesia/Sri Lanka Tsunami",
              "The 1990 Iran Earthquake",
            ],
            correct: 1,
            explanation: "The 1976 China earthquake is cited as having caused about 700,000 deaths, the highest in the list.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The theory that the 1993 Latur-Osmanabad (Maharashtra) earthquake in the otherwise stable Peninsular block was due to reactivation of an old fault line, is linked to which river?",
            options: ["The Godavari", "The Bhima (Krishna)", "The Tapi", "The Narmada"],
            correct: 1,
            explanation: "The reactivated fault line is represented by the Bhima (Krishna) river near Latur and Osmanabad.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "India's earthquake hazard zones are classified into five categories based on the MSK intensity scale, ranging from Very High Damage Risk Zone (MSK IX) to:",
            options: [
              "Moderate Damage Risk Zone (MSK VII) only",
              "Very Low Damage Risk Zone (MSK V)",
              "High Damage Risk Zone (MSK VIII) only",
              "No zoning classification exists",
            ],
            correct: 1,
            explanation: "The zones range from Very High Damage Risk Zone (MSK IX) down to Very Low Damage Risk Zone (MSK V).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT listed as a step for earthquake hazard mitigation?",
            options: [
              "Establishing seismological monitoring centres",
              "Preparing and disseminating vulnerability maps",
              "Encouraging construction of large industrial establishments in high-risk zones",
              "Making earthquake-resistant building designs mandatory",
            ],
            correct: 2,
            explanation: "Large industrial establishments and high-rise buildings are discouraged, not encouraged, in vulnerable zones.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A tsunami, also called a 'harbour wave' or seismic sea wave, is caused by the sudden displacement of ocean water, typically due to earthquakes or:",
            options: ["Strong winds", "Volcanic eruptions", "High tides", "Ocean currents"],
            correct: 1,
            explanation: "Tsunamis can also be caused by volcanic eruptions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "As tsunami waves enter shallow water near the coast, their wavelength decreases while their:",
            options: [
              "Speed increases dramatically",
              "Wave-height increases, sometimes reaching 15 m or more",
              "Period decreases sharply",
              "Energy is completely lost",
            ],
            correct: 1,
            explanation: "In shallow water, tsunami wave-height increases significantly, sometimes exceeding 15 m.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After the 2004 tsunami disaster, in which more than 300,000 people worldwide lost their lives, India volunteered to join the:",
            options: ["Yokohama Strategy", "International Tsunami Warning System", "Ramsar Convention", "Kyoto Protocol"],
            correct: 1,
            explanation: "India joined the International Tsunami Warning System after the 2004 disaster.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "One of the essential conditions for the emergence of a tropical cyclone is a strong Coriolis force, since its absence near the equator prohibits cyclone formation between:",
            options: ["0°-5° latitude", "10°-15° latitude", "20°-25° latitude", "30°-35° latitude"],
            correct: 0,
            explanation: "The Coriolis force is too weak near the equator (0°-5°) for cyclones to form there.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The centre of a tropical cyclone, a warm, low-pressure, cloudless core, is known as the:",
            options: ["Eye wall", "Eye of the storm", "Vortex", "Monsoon trough"],
            correct: 1,
            explanation: "This warm, calm centre of a cyclone is called the 'eye of the storm'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In the Bay of Bengal, tropical cyclones mostly develop during which months?",
            options: ["January-February", "June-July", "October-November", "December only"],
            correct: 2,
            explanation: "Bay of Bengal cyclones mostly develop in October and November.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "An abnormal rise in sea level near the coast, generated by the interaction of air, sea and land during a tropical cyclone, is called a:",
            options: ["Tsunami", "Storm surge", "Tidal wave", "Seiche"],
            correct: 1,
            explanation: "This abnormal rise in sea level is called a storm surge.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Rashtriya Barh Ayog (National Flood Commission) identified about how many hectares of land in India as flood-prone?",
            options: ["4 million", "40 million", "100 million", "400 million"],
            correct: 1,
            explanation: "The National Flood Commission identified about 40 million hectares of flood-prone land in India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is cited in the chapter as a positive contribution of floods, despite their overall destructive impact?",
            options: [
              "Floods spread waterborne diseases",
              "Floods deposit fertile silt over agricultural fields, benefiting crops",
              "Floods destroy infrastructure",
              "Floods cause permanent population displacement",
            ],
            correct: 1,
            explanation: "Floods deposit fertile silt, benefiting agriculture in some areas, though this is minor compared to the losses.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Majuli in Assam, the largest riverine island in the world, is cited as an example of good paddy crops resulting from the annual floods of the:",
            options: ["Ganga", "Brahmaputra", "Godavari", "Krishna"],
            correct: 1,
            explanation: "Majuli benefits from the annual floods of the Brahmaputra.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "'Agricultural Drought', also known as soil moisture drought, excludes areas from the drought-prone category if more than what percentage of their gross cropped area is under irrigation?",
            options: ["10%", "30%", "50%", "70%"],
            correct: 1,
            explanation: "Areas with more than 30% of gross cropped area under irrigation are excluded from the drought-prone category.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The 'Extreme Drought Affected' category, including districts like Jaisalmer and Barmer that receive less than 90 mm of average annual rainfall, is found mostly in:",
            options: [
              "West Bengal and Odisha",
              "Western Rajasthan (Marusthali) and the Kachchh region of Gujarat",
              "Maharashtra and Karnataka",
              "Assam and Meghalaya",
            ],
            correct: 1,
            explanation: "Extreme drought-affected areas are found in western Rajasthan and Kachchh.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Landslides are generally considered relatively less dramatic than earthquakes or cyclones, mainly because they are:",
            options: [
              "Entirely unpredictable and affect huge areas",
              "Largely controlled by highly localised factors",
              "Never caused by human activity",
              "Restricted only to coastal regions",
            ],
            correct: 1,
            explanation: "Landslides are controlled by highly localised factors, unlike large-scale disasters.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the landslide vulnerability zoning in the chapter, the young mountainous areas of the Himalaya, Andaman & Nicobar, and the high-rainfall steep slopes of the Western Ghats and Nilgiris fall under the:",
            options: [
              "Moderate to Low Vulnerability Zone",
              "Very High Vulnerability Zone",
              "No Vulnerability Zone",
              "Only the High Vulnerability Zone",
            ],
            correct: 1,
            explanation: "These areas fall under the Very High Vulnerability Zone for landslides.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The three stages involved in disaster mitigation and management are pre-disaster management, during-disaster rescue and relief operations, and:",
            options: [
              "Immediate abandonment of the affected area",
              "Post-disaster rehabilitation and recovery",
              "Permanent relocation of all residents",
              "No further action required",
            ],
            correct: 1,
            explanation: "The third stage is post-disaster rehabilitation and recovery.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
    ],
  },
  {
    slug: "history",
    name: "History",
    topics: [
      {
        slug: "ancient-india",
        name: "Ancient India",
        questions: [
          q({
            text: "The Indus Valley Civilization's Great Bath was found at which site?",
            options: ["Harappa", "Mohenjodaro", "Lothal", "Dholavira"],
            correct: 1,
            explanation: "The Great Bath, a large public water tank, was discovered at Mohenjodaro.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Who was the founder of the Maurya Empire?",
            options: ["Ashoka", "Bindusara", "Chandragupta Maurya", "Bimbisara"],
            correct: 2,
            explanation: "Chandragupta Maurya founded the Maurya Empire around 322 BCE with Chanakya's guidance.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Third Buddhist Council was held during the reign of which ruler?",
            options: ["Ashoka", "Kanishka", "Harsha", "Chandragupta II"],
            correct: 0,
            explanation:
              "The Third Buddhist Council was convened under Emperor Ashoka at Pataliputra, presided over by Moggaliputta Tissa.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2018,
          }),
        ],
      },
      {
        slug: "modern-india",
        name: "Modern India",
        questions: [
          q({
            text: "The Bhoodan (land-gift) movement, in which landlords voluntarily donated land for redistribution to the landless, was:",
            options: [
              "An initiative independent of the government, though supported by the Congress",
              "A movement led personally by Jayaprakash Narayan from its founding",
              "A government-run land reform scheme",
              "Restricted only to Bihar",
            ],
            correct: 0,
            explanation: "The Bhoodan movement was started by Vinoba Bhave in 1951 as a voluntary initiative independent of the government, though it received support from the Indian National Congress; Jayaprakash Narayan joined and extended it later with the Gramdan movement, but did not found it.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The 'Bombay Plan' of 1944-45, an economic development blueprint for independent India, was authored by:",
            options: [
              "A group of leading Indian industrialists",
              "The Planning Commission of India",
              "The British colonial government",
              "The Indian National Trade Union Congress",
            ],
            correct: 0,
            explanation: "The Bombay Plan (1944-45) was drawn up by a group of prominent Indian industrialists, including J.R.D. Tata and G.D. Birla, proposing a mixed economy with state-led planning for post-independence India.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Who served as the chief statistical advisor to Prime Minister Jawaharlal Nehru during the framing of India's Second Five Year Plan?",
            options: ["P.C. Mahalanobis", "V.K.R.V. Rao", "D.R. Gadgil", "K.N. Raj"],
            correct: 0,
            explanation: "P.C. Mahalanobis, the statistician who founded the Indian Statistical Institute, was the chief architect and advisor behind the Second Five Year Plan's growth model emphasising heavy industry.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "India's first iron and steel company, set up by Jamsetji Tata's enterprise, began production at which city, which grew into a major industrial town?",
            options: ["Jamshedpur", "Bhilai", "Durgapur", "Rourkela"],
            correct: 0,
            explanation: "The Tata Iron and Steel Company (TISCO) set up India's first iron and steel plant at Sakchi, which was later renamed Jamshedpur after Jamsetji Tata.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The book 'The Indian War of Independence, 1857', which described the 1857 revolt as India's first war of independence, was written by:",
            options: ["V.D. Savarkar", "Bipin Chandra Pal", "R.C. Majumdar", "Surendranath Banerjee"],
            correct: 0,
            explanation: "V.D. Savarkar's 'The Indian War of Independence, 1857', first published in 1909, reinterpreted the 1857 revolt as a planned war of national independence rather than a mere mutiny.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Quit India Movement was launched in which year?",
            options: ["1930", "1942", "1940", "1947"],
            correct: 1,
            explanation: "The Quit India Movement began on 8 August 1942 after the Cripps Mission failed.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Who founded the Brahmo Samaj?",
            options: ["Swami Vivekananda", "Raja Ram Mohan Roy", "Dayanand Saraswati", "Ishwar Chandra Vidyasagar"],
            correct: 1,
            explanation: "Raja Ram Mohan Roy founded the Brahmo Samaj in 1828 in Calcutta.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Government of India Act, 1935 provided for provincial autonomy and a federation of which units?",
            options: [
              "British provinces only",
              "Princely states only",
              "British provinces and princely states",
              "Only Bengal and Bombay",
            ],
            correct: 2,
            explanation:
              "The Act of 1935 proposed an All-India Federation comprising British provinces and princely states, though the federal part never came into force.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "how-when-and-where-class8",
        name: "How, When and Where (Class 8)",
        questions: [
          q({
            text: "In 1817, James Mill, a Scottish economist and political philosopher, published 'A History of British India', in which he divided Indian history into three periods. Which of the following was NOT one of them?",
            options: ["Hindu", "Muslim", "British", "Colonial"],
            correct: 3,
            explanation: "James Mill divided Indian history into 'Hindu', 'Muslim' and 'British' periods; 'colonial' is the term many historians use instead, precisely to critique Mill's scheme.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to James Mill, British rule could 'civilise' India because, in his view, India was not capable of progress without British help. What did Mill believe characterised the period before British rule?",
            options: [
              "Scientific advancement and religious tolerance",
              "Religious intolerance, caste taboos and superstitious practices",
              "Economic growth and political stability",
              "Democratic institutions and liberty",
            ],
            correct: 1,
            explanation: "Mill believed that before British rule, Hindu and Muslim despots ruled the country, and that religious intolerance, caste taboos and superstitious practices dominated social life.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Many historians moved away from British and 'ancient-medieval-modern' classifications and instead refer to the period of British dominance in India as:",
            options: ["Classical", "Colonial", "Renaissance", "Imperial Age"],
            correct: 1,
            explanation: "Many historians refer to this period as 'colonial', since British rule brought about political, economic, social and cultural subjugation rather than genuine 'modernity'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Why is the NCERT Class 8 History textbook titled 'Our Pasts', in the plural?",
            options: [
              "Because it covers multiple countries",
              "Because all classes and groups did not experience colonial changes in the same way",
              "Because it was written by multiple authors",
              "Because India had many kings",
            ],
            correct: 1,
            explanation: "The book is called 'Our Pasts' in the plural because all classes and groups did not experience the changes of colonisation in the same way.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The British set up specialised institutions such as archives and museums to preserve important administrative records. Where were the National Archives of India and the National Museum located when New Delhi was built?",
            options: [
              "Far from the city centre",
              "Close to the Viceregal Palace",
              "Inside the Red Fort",
              "In Calcutta only",
            ],
            correct: 1,
            explanation: "The National Archives and National Museum were located close to the Viceregal Palace, reflecting the importance these institutions had in British imagination.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "From the end of the nineteenth century, which operation was held every ten years to prepare detailed records of the population, noting information on castes, religions and occupation?",
            options: ["Land Survey", "Census operations", "Revenue Survey", "Forest Survey"],
            correct: 1,
            explanation: "Census operations were held every ten years from the end of the nineteenth century, recording detailed population data.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the chapter, what is a major limitation of using only official British administrative records to understand colonial India?",
            options: [
              "They contain no dates",
              "They tell us what officials thought and wished to preserve, not what ordinary people felt",
              "They were all destroyed",
              "They were written in Sanskrit",
            ],
            correct: 1,
            explanation: "Official records reflect what officials thought, were interested in, and wished to preserve for posterity — they do not tell us what other people in the country felt or why they acted as they did.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following sources would help historians understand how tribals, peasants, and the poor experienced colonial history, as opposed to official records?",
            options: [
              "Only government gazettes",
              "Diaries, autobiographies, popular booklets and newspapers",
              "Only court judgments",
              "Only survey maps",
            ],
            correct: 1,
            explanation: "Diaries of people, accounts of pilgrims and travellers, autobiographies, and popular booklets sold in bazaars help us go beyond official records, though even these were mostly produced by the literate.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "from-trade-to-territory-class8",
        name: "From Trade to Territory: The Company Establishes Power (Class 8)",
        questions: [
          q({
            text: "The kingdom of Awadh was annexed by the British East India Company, on the pretext of misgovernance, in the year:",
            options: ["1856", "1849", "1801", "1764"],
            correct: 0,
            explanation: "The British East India Company annexed Awadh in 1856, claiming it was necessary to end alleged misgovernance by the Nawab, a step that became a major grievance leading up to the Revolt of 1857.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "In 1600, the East India Company acquired a charter from which English monarch, granting it the sole right to trade with the East?",
            options: ["King James I", "Queen Elizabeth I", "Queen Victoria", "King Charles II"],
            correct: 1,
            explanation: "Queen Elizabeth I granted the East India Company a charter in 1600, giving it the sole right among English traders to trade with the East.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Who was the Portuguese explorer credited with discovering the sea route to India in 1498, arriving before the English at the western coast?",
            options: ["Ferdinand Magellan", "Vasco da Gama", "Christopher Columbus", "James Rennel"],
            correct: 1,
            explanation: "Vasco da Gama, a Portuguese explorer, discovered the sea route to India in 1498, and the Portuguese established their base at Goa.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The first English factory in Bengal was set up in 1651 on the banks of which river?",
            options: ["The Ganga", "The Hugli", "The Yamuna", "The Brahmaputra"],
            correct: 1,
            explanation: "The first English factory was set up on the banks of the river Hugli in 1651, the base from which Company 'factors' operated.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1717, the Company persuaded the Mughal emperor Aurangzeb to issue a document granting it the right to trade duty free. What was this document called?",
            options: ["Sanad", "Farman", "Firman-e-Mahal", "Nishan"],
            correct: 1,
            explanation: "A 'farman' is a royal edict; Aurangzeb's farman granted the East India Company the right to trade duty free in Bengal.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Battle of Plassey (1757) became famous because it was the first major victory the Company won in India. Who was the Nawab of Bengal defeated by Robert Clive in this battle?",
            options: ["Mir Jafar", "Sirajuddaulah", "Alivardi Khan", "Mir Qasim"],
            correct: 1,
            explanation: "Robert Clive defeated Sirajuddaulah at the Battle of Plassey in 1757, with the crucial betrayal of Mir Jafar, one of Sirajuddaulah's own commanders.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "After the Battle of Plassey, the Company installed Mir Jafar as Nawab. When Mir Jafar protested against Company demands, he was deposed and replaced by:",
            options: ["Mir Qasim", "Sirajuddaulah", "Shuja-ud-Daulah", "Bahadur Shah Zafar"],
            correct: 0,
            explanation: "Mir Jafar was deposed and Mir Qasim installed in his place; when Mir Qasim later complained, he was defeated at the Battle of Buxar (1764) and Mir Jafar reinstalled.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In which battle of 1764 was Mir Qasim, allied with the Nawab of Awadh and the Mughal emperor, decisively defeated by the Company?",
            options: ["Battle of Plassey", "Battle of Buxar", "Battle of Panipat", "Battle of Seringapatam"],
            correct: 1,
            explanation: "The Battle of Buxar (1764) resulted in the defeat of Mir Qasim's alliance, after which the Company appointed Residents in Indian states.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1765, the Mughal emperor appointed the East India Company as the 'Diwan' of Bengal. What power did this grant confer?",
            options: [
              "Military command over Bengal's army",
              "The right to collect revenue and use the vast resources of Bengal",
              "The right to appoint the Nawab directly",
              "Control over religious institutions",
            ],
            correct: 1,
            explanation: "The Diwani allowed the Company to use the vast revenue resources of Bengal, solving its earlier problem of having to import gold and silver from Britain to buy Indian goods.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Company officials who returned to Britain after making a fortune in India and led flashy, wealthy lives were mockingly called:",
            options: ["Nabobs", "Zamindars", "Sardars", "Residents"],
            correct: 0,
            explanation: "'Nabobs' — an anglicised version of 'nawab' — was the term used, often mockingly, for Company officials who returned to Britain with vast Indian fortunes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under the system of 'subsidiary alliance' devised by the Company, what were Indian rulers required to give up?",
            options: [
              "Their religion",
              "The right to maintain independent armed forces",
              "Their capital cities",
              "Their language",
            ],
            correct: 1,
            explanation: "Under subsidiary alliance, Indian rulers were not allowed to have independent armed forces; they were protected by the Company but had to pay for the 'subsidiary forces' maintained for that protection.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under Lord Hastings (Governor-General, 1813-1823), the Company adopted a new policy claiming its authority was supreme and greater than that of any Indian state. What was this policy called?",
            options: ["Doctrine of Lapse", "Paramountcy", "Subsidiary Alliance", "Permanent Settlement"],
            correct: 1,
            explanation: "The policy of 'paramountcy' claimed that Company authority was paramount or supreme, justifying annexation or threats of annexation of Indian kingdoms.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which two rulers of Mysore fought four wars against the British between 1767 and 1799, with the Company only winning the last, the Battle of Seringapatam?",
            options: [
              "Nana Saheb and Tantia Tope",
              "Haidar Ali and Tipu Sultan",
              "Mahadji Sindhia and Nana Phadnis",
              "Ranjit Singh and Kunwar Singh",
            ],
            correct: 1,
            explanation: "Haidar Ali (r. 1761-1782) and his son Tipu Sultan (r. 1782-1799) fought four Anglo-Mysore Wars; Tipu Sultan was killed defending Seringapatam in 1799.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Maratha confederacy of chiefs (Sindhia, Holkar, Gaikwad, Bhonsle) was held together under a Principal Minister known as the:",
            options: ["Peshwa", "Diwan", "Subadar", "Vazir"],
            correct: 0,
            explanation: "The Maratha chiefs (sardars) were held together in a confederacy under a Peshwa, who was the effective military and administrative head, based in Pune.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which decisive event shattered the Marathas' dream of ruling from Delhi in 1761?",
            options: ["The Third Battle of Panipat", "The Battle of Plassey", "The Treaty of Salbai", "The Battle of Buxar"],
            correct: 0,
            explanation: "The Marathas' defeat in the Third Battle of Panipat (1761) shattered their dream of ruling from Delhi, after which they split into regional states under different chiefs.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Doctrine of Lapse, devised by Lord Dalhousie (Governor-General, 1848-1856), declared that a kingdom would become Company territory if:",
            options: [
              "Its ruler refused to pay tribute",
              "Its ruler died without a male heir",
              "Its ruler was defeated in battle",
              "Its ruler converted to another religion",
            ],
            correct: 1,
            explanation: "Under the Doctrine of Lapse, if a ruler died without a natural male heir, his kingdom would 'lapse' and become part of Company territory. Satara, Sambalpur, Udaipur, Nagpur and Jhansi were annexed this way.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In 1856, the Company annexed Awadh on the argument that it was 'obliged by duty' to free the people from the Nawab's misgovernment. What was the consequence of this annexation?",
            options: [
              "It was welcomed by the people of Awadh",
              "It enraged the people of Awadh, who later joined the Revolt of 1857",
              "It had no effect on public sentiment",
              "It led to immediate British withdrawal from India",
            ],
            correct: 1,
            explanation: "The humiliating annexation of Awadh in 1856 enraged its people, and Awadh became one of the centres of the great revolt that broke out in 1857.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Who led an anti-British resistance movement against the annexation of the small state of Kitoor (in present-day Karnataka) and was arrested in 1824?",
            options: ["Rani Lakshmibai", "Rani Channamma", "Rani Avantibai", "Begum Hazrat Mahal"],
            correct: 1,
            explanation: "Rani Channamma of Kitoor led an anti-British resistance movement, was arrested in 1824, and died in prison in 1829.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Warren Hastings, the first Governor-General of the East India Company (1773-1785), introduced administrative reforms notably in which sphere?",
            options: ["Agriculture", "Justice", "Textile trade", "Railways"],
            correct: 1,
            explanation: "Warren Hastings introduced several administrative reforms, notably establishing a new system of justice from 1772, with separate criminal (faujdari adalat) and civil (diwani adalat) courts.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Company's army came to be known as the 'sepoy army', derived from the Indian word:",
            options: ["Sawar", "Sipahi", "Paidal", "Faujdar"],
            correct: 1,
            explanation: "'Sepoy' is derived from the Indian word 'sipahi', meaning soldier; the Company recruited peasants and trained them as professional soldiers, following the practice of states like Awadh and Benaras.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "By 1857, the East India Company exercised direct rule over approximately what percentage of the territory of the Indian subcontinent?",
            options: ["33 per cent", "50 per cent", "63 per cent", "90 per cent"],
            correct: 2,
            explanation: "By 1857, the Company came to exercise direct rule over about 63 per cent of the territory and 78 per cent of the population of the Indian subcontinent.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "ruling-the-countryside-class8",
        name: "Ruling the Countryside (Class 8)",
        questions: [
          q({
            text: "On 12 August 1765, the Mughal emperor appointed the East India Company as the Diwan of which regions?",
            options: ["Punjab and Sindh", "Bengal, Bihar and Orissa", "Awadh and Delhi", "Madras and Bombay"],
            correct: 1,
            explanation: "The Mughal ruler appointed the Company as Diwan of Bengal, Bihar and Orissa on 12 August 1765, making it the chief financial administrator of the territory.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The terrible famine of 1770 killed how many people in Bengal, wiping out about one-third of the population?",
            options: ["1 million", "5 million", "10 million", "20 million"],
            correct: 2,
            explanation: "The 1770 Bengal famine killed about ten million people, roughly one-third of the population, following years of Company revenue extraction and economic crisis.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under the Permanent Settlement introduced in 1793 by Governor-General Cornwallis, who was recognised as zamindars and made responsible for collecting rent and paying revenue?",
            options: ["Village headmen", "Rajas and taluqdars", "Company officials", "British planters"],
            correct: 1,
            explanation: "The Permanent Settlement of 1793 recognised rajas and taluqdars as zamindars, fixing the revenue they had to pay permanently, in the hope of encouraging investment in land.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "What was the main problem with the Permanent Settlement, as Company officials soon discovered?",
            options: [
              "Zamindars invested too much in land improvement",
              "Zamindars were not investing in improving the land since the revenue demand was fixed too high",
              "The zamindars refused to collect any revenue",
              "The system generated too much revenue for the Company",
            ],
            correct: 1,
            explanation: "Zamindars found the fixed revenue too high to pay and had little incentive to invest in improving the land, since any increased income from higher production could not be captured by the Company under a permanently fixed demand.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The revenue system devised by Holt Mackenzie in 1822 in the North Western Provinces, under which the demand was revised periodically and collected through village headmen, was known as the:",
            options: ["Ryotwari system", "Mahalwari system", "Permanent Settlement", "Zamindari system"],
            correct: 1,
            explanation: "The mahalwari settlement, devised by Holt Mackenzie, calculated revenue per village (mahal), to be revised periodically and collected by the village headman rather than a zamindar.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The 'ryotwar' (or ryotwari) system, developed by Thomas Munro and tried earlier by Captain Alexander Read, made settlements directly with:",
            options: ["Zamindars", "Village headmen", "Cultivators (ryots)", "British planters"],
            correct: 2,
            explanation: "Read and Munro argued that since the south had no traditional zamindars, settlements should be made directly with the ryots (cultivators) who had tilled the land for generations.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "By the late eighteenth century, the Company was trying its best to expand cultivation of which two crops it needed most for European markets?",
            options: ["Cotton and jute", "Opium and indigo", "Wheat and rice", "Sugarcane and tea"],
            correct: 1,
            explanation: "The Company was expanding the cultivation of opium and indigo by the late eighteenth century, later forcing production of other crops like jute, tea, sugarcane, wheat and cotton in various regions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Cloth dyers preferred indigo to woad because indigo produced a much richer colour. What colour did indigo produce?",
            options: ["Rich red", "Rich blue", "Rich green", "Rich black"],
            correct: 1,
            explanation: "Indigo produced a rich blue colour, whereas the dye from woad (a temperate-zone plant grown in Europe) was pale and dull.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Under the 'nij' system of indigo cultivation, planters produced indigo:",
            options: [
              "On land directly controlled by the planter, using hired labour",
              "On land belonging to the ryots, under a loan contract",
              "Only in government-owned plantations",
              "Through cooperative farming societies",
            ],
            correct: 0,
            explanation: "Under nij cultivation, the planter produced indigo on land he directly owned or rented, employing hired labourers, unlike the ryoti system where ryots grew indigo on their own land.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Why did planters find it difficult to expand nij cultivation on a large scale?",
            options: [
              "Indigo could only grow in swamps",
              "It required large compact areas of fertile land, and enough ploughs, bullocks and labour, which were scarce and needed by peasants for rice cultivation at the same time",
              "The colonial government banned nij cultivation",
              "Indigo required no agricultural inputs at all",
            ],
            correct: 1,
            explanation: "Nij cultivation needed large blocks of fertile land (already densely populated) plus vast numbers of ploughs, bullocks and labourers — all in short supply, especially since they were needed by peasants for rice cultivation at the same time.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under the 'ryoti' system, ryots who signed a loan contract (satta) with planters were committed to cultivating indigo on at least what portion of their landholding?",
            options: ["10 per cent", "25 per cent", "50 per cent", "75 per cent"],
            correct: 1,
            explanation: "Ryots who took cash advances under the ryoti system were committed to cultivating indigo on at least 25 per cent of the area under their holding.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The 'Blue Rebellion' (Indigo Revolt) broke out in March 1859 in which region?",
            options: ["Bihar", "Bengal", "Punjab", "Awadh"],
            correct: 1,
            explanation: "In March 1859, thousands of ryots in Bengal refused to grow indigo, refused to pay rents, and attacked indigo factories, marking the start of the 'Blue Rebellion'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The lathi-wielding strongmen maintained by indigo planters, who were used to intimidate and bully the ryots, were called:",
            options: ["Gomasthas", "Lathiyals", "Sardars", "Sepoys"],
            correct: 1,
            explanation: "'Lathiyals' were the lathi-wielding strongmen employed by planters; ryots swore during the rebellion that they would no longer be bullied by them.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The commission set up by the government to enquire into the indigo system, which held planters guilty of coercive methods and declared indigo production unprofitable for ryots, was called the:",
            options: ["Rowlatt Commission", "Indigo Commission", "Simon Commission", "Hunter Commission"],
            correct: 1,
            explanation: "The Indigo Commission, set up after the 1859 rebellion, held planters guilty and declared that indigo production was not profitable for ryots, though it asked them to honour existing contracts.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahatma Gandhi's 1917 visit to which district, after being persuaded by a local peasant, marked the beginning of a movement against indigo planters?",
            options: ["Kheda", "Bardoli", "Champaran", "Ahmedabad"],
            correct: 2,
            explanation: "Mahatma Gandhi's 1917 visit to Champaran in Bihar, where indigo planters continued to oppress cultivators even after the Bengal revolt, marked the start of the Champaran movement.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the villages, the term 'mahal' in British revenue records refers to:",
            options: ["A palace", "A revenue estate, which may be a village or group of villages", "A type of crop", "A moneylender's office"],
            correct: 1,
            explanation: "'Mahal' is a revenue estate in British records, which could be a village or a group of villages, and formed the basis of assessment under the mahalwari system.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "tribals-dikus-golden-age-class8",
        name: "Tribals, Dikus and the Vision of a Golden Age (Class 8)",
        questions: [
          q({
            text: "Birsa Munda, who declared that God had appointed him to free his people from the slavery of 'dikus', led a movement in 1895 among which tribal group of Chottanagpur?",
            options: ["Gonds", "Mundas", "Bhils", "Khonds"],
            correct: 1,
            explanation: "Birsa was born into a family of Mundas, a tribal group of Chottanagpur (in present-day Jharkhand), and his movement drew support from Mundas, Santhals and Oraons.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In jhum cultivation (shifting cultivation), how did cultivators typically sow seeds?",
            options: [
              "By ploughing and drilling seeds in rows",
              "By broadcasting — scattering seeds on the field without ploughing",
              "By transplanting seedlings from nurseries",
              "By using irrigation channels",
            ],
            correct: 1,
            explanation: "Jhum cultivators broadcast seeds, that is, they scattered seeds on the field instead of ploughing the land and sowing in rows.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Khonds, a hunting and gathering tribal community of the forests of which state, went on collective hunts and used oil extracted from sal and mahua seeds to cook food?",
            options: ["Odisha", "Jharkhand", "Chhattisgarh", "Maharashtra"],
            correct: 0,
            explanation: "The Khonds lived in the forests of Orissa (Odisha), practising collective hunting and using sal and mahua oils in cooking.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which tribal community of central India, described in the chapter, saw themselves as 'people of the forest' and considered it below their dignity to work as labourers?",
            options: ["Santhals", "Baigas", "Van Gujjars", "Bakarwals"],
            correct: 1,
            explanation: "The Baigas of central India saw themselves as people of the forest who could only live on forest produce, and considered it below their dignity to become labourers.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Gaddis of Kulu and the Bakarwals of Kashmir are examples of tribal groups who lived primarily by:",
            options: ["Jhum cultivation", "Hunting and gathering", "Herding and pastoralism", "Settled agriculture only"],
            correct: 2,
            explanation: "The Gaddis (shepherds) and Bakarwals (goat herders) were pastoralist tribal groups who moved with their herds according to the seasons.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under British rule, how did the functions and powers of tribal chiefs generally change?",
            options: [
              "They gained more administrative power than before",
              "They kept land titles over villages but lost much of their administrative power and had to follow British laws",
              "They were all removed from their positions entirely",
              "They were given full sovereignty over their territories",
            ],
            correct: 1,
            explanation: "Tribal chiefs were allowed to keep land titles and rent out land but lost much of their earlier administrative power, had to follow laws made by British officials, and had to pay tribute.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which forests were classified by the British as producing timber they wanted, in which people were not allowed to practise jhum cultivation, collect fruits, or hunt?",
            options: ["Protected Forests", "Reserved Forests", "Community Forests", "Village Forests"],
            correct: 1,
            explanation: "Reserved Forests were classified as state property producing timber for British use; jhum cultivation, free movement, fruit collection and hunting were banned there.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "To ensure a regular supply of cheap labour for cutting timber and transporting logs after banning jhum cultivators from forests, the colonial Forest Department established:",
            options: ["Forest villages", "Plantation colonies", "Labour camps", "Mining townships"],
            correct: 0,
            explanation: "The Forest Department established 'forest villages', giving jhum cultivators small patches of land to cultivate in exchange for providing labour and looking after the forests.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Hazaribagh, in present-day Jharkhand, was an area where which tribal community reared silk cocoons for traders, earning very little while middlemen made huge profits?",
            options: ["Santhals", "Gonds", "Bhils", "Mundas"],
            correct: 0,
            explanation: "The Santhals of Hazaribagh reared cocoons; traders' agents gave them loans and collected cocoons cheaply, then sold them at five times the price in Burdwan or Gaya.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the 1920s, about what percentage of the miners in the Jharia and Raniganj coal mines of Bihar were tribals?",
            options: ["20 per cent", "35 per cent", "50 per cent", "80 per cent"],
            correct: 2,
            explanation: "In the 1920s, about 50 per cent of the miners in the Jharia and Raniganj coal mines of Bihar were tribals, working in dangerous and often fatal conditions.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which of the following tribal rebellions is correctly matched with its approximate period?",
            options: [
              "Santhal revolt — 1855",
              "Bastar Rebellion — 1857",
              "Warli Revolt — 1895",
              "Kol rebellion — 1900",
            ],
            correct: 0,
            explanation: "The Santhals rose in revolt in 1855; the Kols rebelled in 1831-32, the Bastar Rebellion broke out in 1910, and the Warli Revolt in Maharashtra occurred in 1940.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Birsa Munda talked of a golden age in the past, a 'satyug', when Mundas lived a good and honest life. What did Birsa urge his followers to do to prepare for this golden age?",
            options: [
              "Migrate to cities for factory work",
              "Give up drinking liquor, clean their villages, and stop believing in witchcraft and sorcery",
              "Convert entirely to Christianity",
              "Abandon farming altogether",
            ],
            correct: 1,
            explanation: "Birsa urged the Mundas to give up drinking liquor, clean their villages, and stop believing in witchcraft and sorcery, aiming to reform tribal society while turning against missionaries, moneylenders and landlords.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "What was the ultimate political aim of the Birsa movement that worried British officials the most?",
            options: [
              "To secure a seat in the Legislative Council",
              "To drive out missionaries, moneylenders, and landlords and establish a Munda Raj under Birsa",
              "To negotiate better wages for plantation labour",
              "To convert all tribals to a new religion",
            ],
            correct: 1,
            explanation: "The Birsa movement wanted to drive out missionaries, moneylenders, Hindu landlords, and the government, and set up a Munda Raj under Birsa's leadership.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In what year did Birsa die of cholera, after which the movement he led faded out?",
            options: ["1895", "1897", "1900", "1906"],
            correct: 2,
            explanation: "Birsa died of cholera in 1900. He had earlier been arrested in 1895 and jailed for two years, released in 1897, after which he continued to gather support until his death.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "revolt-of-1857-class8",
        name: "When People Rebel: 1857 and After (Class 8)",
        questions: [
          q({
            text: "Mangal Pandey, whose refusal to use the new greased cartridges in March 1857 became a spark for the revolt, belonged to which regiment?",
            options: ["34th Bengal Native Infantry", "19th Bengal Native Infantry", "3rd Cavalry, Meerut", "7th Awadh Irregular Infantry"],
            correct: 0,
            explanation: "Mangal Pandey was a sepoy of the 34th Bengal Native Infantry at Barrackpore, whose act of defiance in March 1857 became an early flashpoint of the revolt.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "On which date did the rebel sepoys who had marched from Meerut capture Delhi in 1857?",
            options: ["11 May 1857", "20 September 1857", "10 May 1857", "1 August 1857"],
            correct: 0,
            explanation: "Sepoys who mutinied at Meerut marched to Delhi and captured the city on 11 May 1857, proclaiming the aged Bahadur Shah Zafar as their leader; Delhi was later recaptured by the British on 20 September 1857 after a prolonged siege.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which local leader led the rebellion of 1857 in the Bihar region, particularly around Arrah and Jagdishpur?",
            options: ["Kunwar Singh", "Bakht Khan", "Nana Saheb", "Khan Bahadur Khan"],
            correct: 0,
            explanation: "Kunwar Singh, the aged zamindar of Jagdishpur in Bihar, led the rebellion in the region, fighting the British until his death in 1858.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Which queen's adopted son was refused recognition as heir to the throne by the Company, a grievance that contributed to her later joining the Revolt of 1857?",
            options: ["Begum Hazrat Mahal", "Rani Lakshmibai of Jhansi", "Rani Avantibai Lodhi", "Rani Channamma"],
            correct: 1,
            explanation: "Rani Lakshmibai of Jhansi wanted the Company to recognise her adopted son as heir after her husband's death, but the Company refused, confident of its own superiority.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Sepoys refused an order in 1824 to travel to Burma by sea, believing that crossing the sea would make them lose their religion and caste. What happened as a result?",
            options: [
              "The order was permanently withdrawn",
              "They were severely punished, and a 1856 law required new recruits to agree to serve overseas",
              "They were given higher pay instead",
              "The Company disbanded the army entirely",
            ],
            correct: 1,
            explanation: "The sepoys were severely punished for refusing to go by sea; since the issue persisted, an 1856 law required every new Company army recruit to agree to serve overseas if required.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On 29 March 1857, which young soldier was hanged for attacking his officers at Barrackpore?",
            options: ["Bakht Khan", "Mangal Pandey", "Kunwar Singh", "Tantia Tope"],
            correct: 1,
            explanation: "Mangal Pandey was hanged on 29 March 1857 for attacking his officers at Barrackpore, an early spark of the revolt.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "On 9 May 1857, eighty-five sepoys at Meerut were dismissed and jailed for refusing to do army drill using cartridges suspected of being greased with the fat of which animals?",
            options: ["Goats and sheep", "Cows and pigs", "Horses and camels", "Buffaloes and deer"],
            correct: 1,
            explanation: "The new cartridges were suspected of being coated with the fat of cows and pigs, offending both Hindu and Muslim religious sensibilities.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "On 10 May 1857, soldiers at Meerut released the imprisoned sepoys, killed British officers, and marched overnight to which city, arriving the next morning?",
            options: ["Lucknow", "Kanpur", "Delhi", "Agra"],
            correct: 2,
            explanation: "The Meerut sepoys rode all night on 10 May to reach Delhi, where they were joined by local regiments and proclaimed Bahadur Shah Zafar their leader.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Who was proclaimed Peshwa near Kanpur and expelled the British garrison from the city during the 1857 revolt?",
            options: ["Tantia Tope", "Nana Saheb", "Bakht Khan", "Ahmadullah Shah"],
            correct: 1,
            explanation: "Nana Saheb, the adopted son of the late Peshwa Baji Rao, gathered forces, expelled the British from Kanpur, and proclaimed himself Peshwa as a governor under Bahadur Shah Zafar.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Lucknow during the revolt, Birjis Qadr was proclaimed the new Nawab, and his mother played an active role in organising the uprising. Who was she?",
            options: ["Rani Lakshmibai", "Begum Hazrat Mahal", "Begum Zinat Mahal", "Begum Rokeya"],
            correct: 1,
            explanation: "Begum Hazrat Mahal, mother of the newly proclaimed Nawab Birjis Qadr, actively organised the uprising in Lucknow.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rani Avantibai Lodhi of Ramgarh raised and led an army of four thousand against the British in which region?",
            options: ["Jhansi", "Mandla region of Madhya Pradesh", "Awadh", "Bareilly"],
            correct: 1,
            explanation: "Rani Avantibai Lodhi raised an army of four thousand in the Mandla region of Madhya Pradesh, and chose death by embracing it rather than surrender when surrounded.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which soldier from Bareilly took charge of a large force of fighters and became a key military leader of the rebellion in Delhi?",
            options: ["Kunwar Singh", "Ahmadullah Shah", "Bakht Khan", "Tantia Tope"],
            correct: 2,
            explanation: "Bakht Khan, a soldier from Bareilly, led a large force to Delhi and became a key military leader of the rebellion there.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which old zamindar from Bihar joined the rebel sepoys and battled the British for many months during 1857?",
            options: ["Kunwar Singh", "Bakht Khan", "Ahmadullah Shah", "Nana Saheb"],
            correct: 0,
            explanation: "Kunwar Singh, an old zamindar of Bihar, joined the rebel sepoys and fought the British for many months.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Delhi was recaptured from the rebel forces by the British in which month of 1857?",
            options: ["May 1857", "July 1857", "September 1857", "December 1857"],
            correct: 2,
            explanation: "Delhi was recaptured from the rebel forces in September 1857, though the last Mughal emperor Bahadur Shah Zafar was tried and exiled rather than immediately executed.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Bahadur Shah Zafar, the last Mughal emperor, was tried and sentenced to life imprisonment, and died in which city's jail in 1862?",
            options: ["Calcutta", "Rangoon", "Delhi", "Lucknow"],
            correct: 1,
            explanation: "Bahadur Shah Zafar was sent to Rangoon in October 1858, where he died in the jail in November 1862.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tantia Tope, who continued a guerrilla war in central India after the fall of Delhi and Lucknow, was captured, tried and killed in:",
            options: ["1858", "1859", "1861", "1862"],
            correct: 1,
            explanation: "Tantia Tope escaped to the jungles of central India and continued guerrilla warfare; he was eventually captured, tried, and killed in April 1859.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Following the Government of India Act of 1858, which office was created to give the British Crown direct responsibility for ruling India, replacing the Company's control?",
            options: ["Viceroy and Secretary of State for India", "Governor-General and Prime Minister", "Resident and Diwan", "Collector and Commissioner"],
            correct: 0,
            explanation: "The 1858 Act transferred Company power to the Crown; a Secretary of State for India was appointed in the British Cabinet, and the Governor-General was retitled Viceroy, the Crown's personal representative.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After 1857, the British decided to change the composition of the army, recruiting more soldiers from which communities instead of Awadh, Bihar, central and south India?",
            options: ["Marathas, Rajputs and Bengalis", "Gurkhas, Sikhs and Pathans", "Tamils, Telugus and Malayalis", "Assamese, Odias and Biharis"],
            correct: 1,
            explanation: "After 1857, more soldiers were recruited from among the Gurkhas, Sikhs and Pathans, while the proportion of Indian to European soldiers was also reduced.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Khurda Uprising of 1817 in Odisha, led by Buxi Jagabandhu, involved which group of ex-militia who were dispossessed of their land by British revenue policies?",
            options: ["Paiks", "Ryots", "Zamindars", "Sardars"],
            correct: 0,
            explanation: "The Paiks, the hereditary ex-militia of the deposed Khurda kingdom, rose against British policies of resuming their service tenures and increasing revenue demands, led by their military commander Buxi Jagabandhu.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Khurda/Paik uprising began on 29 March 1817 when the Paiks attacked government establishments at which town, before Buxi Jagabandhu seized Puri?",
            options: ["Cuttack", "Banpur", "Bhubaneswar", "Balasore"],
            correct: 1,
            explanation: "The uprising was set off on 29 March 1817 when the Paiks attacked the police station and government establishments at Banpur, killing over a hundred men.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "weavers-iron-smelters-factory-owners-class8",
        name: "Weavers, Iron Smelters and Factory Owners (Class 8)",
        questions: [
          q({
            text: "Around 1750, before the British conquered Bengal, India held which position in the world's cotton textile production?",
            options: ["A minor regional producer", "The world's largest producer of cotton textiles", "Equal to China only", "A net importer of textiles"],
            correct: 1,
            explanation: "Around 1750, India was by far the world's largest producer of cotton textiles, renowned for fine quality and exquisite craftsmanship.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The English term 'muslin' originated from European traders encountering fine cotton cloth from India carried by Arab merchants in which city?",
            options: ["Baghdad", "Mosul", "Basra", "Damascus"],
            correct: 1,
            explanation: "European traders first encountered fine cotton cloth carried by Arab merchants in Mosul, in present-day Iraq, and began calling all finely woven textiles 'muslin'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The term 'calico', which became the general name for cotton textiles in Europe, is derived from which Indian city?",
            options: ["Cochin", "Calicut", "Calcutta", "Cambay"],
            correct: 1,
            explanation: "The Portuguese, who first landed at Calicut on the Kerala coast, took cotton textiles back to Europe that came to be called 'calico', derived from Calicut.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The English word 'chintz', referring to printed cotton cloth with colourful flowery designs, is derived from the Hindi word:",
            options: ["Chhint", "Bandhna", "Kalamkari", "Jamdani"],
            correct: 0,
            explanation: "'Chintz' is derived from the Hindi word 'chhint', meaning a cloth with small and colourful flowery designs.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1720, the British government enacted a legislation banning the use of printed Indian cotton textiles in England, in order to protect wool and silk producers. What was this Act called?",
            options: ["Cotton Act", "Calico Act", "Textile Protection Act", "Trade Regulation Act"],
            correct: 1,
            explanation: "The Calico Act of 1720 banned the use of printed cotton textiles (chintz) in England, protecting domestic wool and silk producers from Indian competition.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which machine, invented in 1764, increased the productivity of traditional spindles and helped Britain compete with Indian textiles?",
            options: ["Power loom", "Spinning jenny", "Cotton gin", "Water frame"],
            correct: 1,
            explanation: "The spinning jenny, invented by John Kaye in 1764, allowed a single worker to operate several spindles at once, boosting British textile productivity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Dacca in eastern Bengal was the foremost textile centre of the eighteenth century, famous for which type of weaving?",
            options: ["Kalamkari and bandhani", "Mulmul and jamdani", "Ikat and patola", "Chikankari and zardozi"],
            correct: 1,
            explanation: "Dacca (now in Bangladesh) was famous for its mulmul and jamdani weaving, and was one of the most important textile centres in the eighteenth century.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The first stage of textile production, spinning thread on the charkha and takli, was mostly done by:",
            options: ["Men", "Women", "Children only", "Specialist block printers"],
            correct: 1,
            explanation: "Spinning was mostly work done by women; weaving the spun thread into cloth was usually a task done by men.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "By the 1880s, what fraction of all the cotton clothes worn by Indians were made of cloth produced in Britain?",
            options: ["One-third", "Half", "Two-thirds", "Nine-tenths"],
            correct: 2,
            explanation: "By the 1880s, two-thirds of all the cotton clothes worn by Indians were made of cloth produced in Britain, following the flooding of Indian markets with British cloth.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahatma Gandhi's call to boycott imported textiles and use hand-spun, hand-woven cloth made which item a symbol of Indian nationalism, later placed at the centre of the Congress's tricolour flag adopted in 1931?",
            options: ["The takli", "The charkha", "The loom", "The sari"],
            correct: 1,
            explanation: "Khadi and the charkha (spinning wheel) became symbols of nationalism, with the charkha placed at the centre of the Indian National Congress's tricolour flag adopted in 1931.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The first cotton mill in India was set up as a spinning mill in which city, in 1854?",
            options: ["Ahmedabad", "Kanpur", "Bombay", "Nagpur"],
            correct: 2,
            explanation: "The first cotton mill in India was set up as a spinning mill in Bombay in 1854, close to the black soil tract of western India where cotton was grown.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The first major spurt in the development of cotton factory production in India occurred during which event, when British textile imports declined?",
            options: ["The Swadeshi Movement", "The First World War", "The Great Depression", "The Second World War"],
            correct: 1,
            explanation: "The first major spurt in India's cotton factory production came during the First World War, when textile imports from Britain declined and Indian factories had to supply cloth for military needs.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Tipu Sultan's legendary swords owed their incredibly hard and sharp edge to a special type of high-carbon steel produced across south India, called:",
            options: ["Damascus steel", "Wootz steel", "Toledo steel", "Bessemer steel"],
            correct: 1,
            explanation: "Wootz steel, produced through an intricate smelting process using iron and charcoal in clay pots, gave Tipu's swords their famed sharpness with a flowing water pattern.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which legendary scientist, the discoverer of electricity and electromagnetism, spent four years (1818-22) studying the properties of Indian Wootz steel?",
            options: ["Isaac Newton", "Michael Faraday", "James Watt", "Charles Darwin"],
            correct: 1,
            explanation: "Michael Faraday studied the properties of Indian Wootz steel between 1818 and 1822, fascinated by its unique qualities.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which community of iron smelters, found across Central India, worked their furnaces using local ore deposits, with women working the bellows to keep charcoal burning?",
            options: ["Agarias", "Baigas", "Santhals", "Gonds"],
            correct: 0,
            explanation: "The Agarias were a community specialised in iron smelting; a series of late-nineteenth-century famines caused many to abandon their furnaces and migrate.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which two individuals, travelling in Chhattisgarh in 1904, discovered the fine iron ore of the Rajhara Hills that would later supply the Bhilai Steel Plant?",
            options: [
              "Jamsetji Tata and Robert Clive",
              "Charles Weld and Dorabji Tata",
              "William Jones and Henry Colebrooke",
              "Thomas Munro and Alexander Read",
            ],
            correct: 1,
            explanation: "Charles Weld, an American geologist, and Dorabji Tata (Jamsetji Tata's eldest son) discovered the Rajhara Hills ore deposits with the help of local Agarias.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Tata Iron and Steel Company (TISCO), which began producing steel in 1912, was set up at an industrial township established on the banks of which river?",
            options: ["Damodar", "Subarnarekha", "Mahanadi", "Godavari"],
            correct: 1,
            explanation: "TISCO's factory and the township of Jamshedpur were established on the banks of the river Subarnarekha, near iron ore deposits with an available water source.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "By 1919, during the First World War, what percentage of the steel manufactured by TISCO was being bought by the colonial government?",
            options: ["50 per cent", "70 per cent", "90 per cent", "100 per cent"],
            correct: 2,
            explanation: "By 1919, the colonial government was buying 90 per cent of the steel manufactured by TISCO, as it produced rails, shells and carriage wheels for the war effort.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "civilising-native-educating-nation-class8",
        name: "Civilising the 'Native', Educating the Nation (Class 8)",
        questions: [
          q({
            text: "William Jones, who arrived in Calcutta in 1783 as a junior judge and was also a skilled linguist, co-founded which society to study ancient Indian texts?",
            options: ["Asiatic Society of Bengal", "Brahmo Samaj", "Arya Samaj", "Servants of India Society"],
            correct: 0,
            explanation: "William Jones, along with Henry Thomas Colebrooke and Nathaniel Halhed, set up the Asiatic Society of Bengal and started the journal Asiatick Researches.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Orientalists like William Jones believed that Indian civilisation had attained its glory in which period, subsequently declining?",
            options: ["The medieval period", "The ancient past", "The Mughal era", "The colonial period"],
            correct: 1,
            explanation: "Orientalists believed Indian civilisation had attained its glory in the ancient past but had subsequently declined, making it necessary to rediscover ancient sacred and legal texts.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A madrasa to promote the study of Arabic, Persian and Islamic law was set up in Calcutta in 1781, while the Hindu College to encourage the study of ancient Sanskrit texts was established in which city in 1791?",
            options: ["Calcutta", "Benaras", "Bombay", "Delhi"],
            correct: 1,
            explanation: "The Hindu College was established in Benaras in 1791 to encourage the study of ancient Sanskrit texts useful for administering the country.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which influential critic of the Orientalists famously declared that 'a single shelf of a good European library was worth the whole native literature of India and Arabia'?",
            options: ["James Mill", "William Jones", "Thomas Babington Macaulay", "Charles Wood"],
            correct: 2,
            explanation: "Thomas Babington Macaulay made this famous statement, arguing that no branch of Eastern knowledge could compare to what England had produced.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Following Macaulay's Minute, the English Education Act of 1835 decided to make which language the medium of instruction for higher education in India?",
            options: ["Sanskrit", "Persian", "Hindi", "English"],
            correct: 3,
            explanation: "The English Education Act of 1835 made English the medium of instruction for higher education, and stopped the promotion of Oriental institutions like the Calcutta Madrasa and Benaras Sanskrit College.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The 1854 educational policy document sent by the Court of Directors of the East India Company, emphasising the practical and economic benefits of European learning, is known as:",
            options: ["Macaulay's Minute", "Wood's Despatch", "The Ilbert Bill", "The Hunter Commission Report"],
            correct: 1,
            explanation: "Wood's Despatch of 1854, issued by Charles Wood, outlined the educational policy emphasising European learning's practical benefits for trade, commerce and moral character.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Until 1813, the East India Company was opposed to missionary activities in India, fearing they would provoke reaction; where did missionaries first set up a mission outside British-controlled territories?",
            options: ["Serampore", "Madras", "Bombay", "Surat"],
            correct: 0,
            explanation: "Missionaries set up a mission at Serampore, in territory controlled by the Danish East India Company, establishing a printing press in 1800 and a college in 1818.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to William Adam's 1830s report on vernacular education in Bengal and Bihar, how many pathshalas were found, teaching over 20 lakh children in total?",
            options: ["10,000", "50,000", "Over 1 lakh", "5 lakh"],
            correct: 2,
            explanation: "William Adam found over 1 lakh pathshalas in Bengal and Bihar, each with no more than 20 students, but together teaching over 20 lakh children.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the pre-colonial pathshala system, why could even children of peasant families study, unlike under the later British-regulated system?",
            options: [
              "Because education was compulsory by law",
              "Because classes were not held during harvest time, allowing flexibility",
              "Because peasants did not need their children's labour",
              "Because pathshalas provided free food and lodging",
            ],
            correct: 1,
            explanation: "The flexible pathshala system did not hold classes during harvest time, when rural children often worked in the fields, allowing even peasant children to attend school.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahatma Gandhi argued that English education 'enslaved' Indians because it:",
            options: [
              "Taught only religious subjects",
              "Created a sense of inferiority, made Indians see Western civilisation as superior, and distanced them from their own culture",
              "Was too expensive for most families",
              "Focused excessively on vocational training",
            ],
            correct: 1,
            explanation: "Gandhi argued colonial education created a sense of inferiority in Indians' minds, made them admire Western civilisation and British rule, and distanced them from their own social surroundings.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rabindranath Tagore established Santiniketan in 1901, choosing a rural setting 100 kilometres from Calcutta because he believed:",
            options: [
              "Cities had insufficient teachers",
              "Creative learning could be encouraged only within a natural environment",
              "Rural land was cheaper to acquire",
              "It was closer to his family estate",
            ],
            correct: 1,
            explanation: "Tagore believed creative learning could be encouraged only within a natural environment, seeing Santiniketan (abode of peace) as a place where children could live in harmony with nature.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Unlike Mahatma Gandhi, who was highly critical of Western civilisation's worship of machines, Rabindranath Tagore's educational vision:",
            options: [
              "Rejected Western civilisation entirely",
              "Sought to combine elements of modern Western civilisation with the best of Indian tradition, including teaching science and technology",
              "Focused exclusively on religious instruction",
              "Rejected the teaching of art and music",
            ],
            correct: 1,
            explanation: "Tagore wanted to combine modern Western civilisation with Indian tradition, emphasising science and technology alongside art, music and dance at Santiniketan.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "women-caste-and-reform-class8",
        name: "Women, Caste and Reform (Class 8)",
        questions: [
          q({
            text: "The practice in which widows were praised for choosing to burn themselves on their husband's funeral pyre, being called 'sati' or virtuous women, was banned in which year?",
            options: ["1817", "1829", "1856", "1872"],
            correct: 1,
            explanation: "Sati was banned in 1829, following a long campaign by Raja Rammohun Roy, who showed through his writings that widow burning had no sanction in ancient texts.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Raja Rammohun Roy founded which reform association in Calcutta, later known as the Brahmo Samaj?",
            options: ["Arya Samaj", "Brahmo Sabha", "Prarthana Samaj", "Satyashodhak Samaj"],
            correct: 1,
            explanation: "Rammohun Roy founded the Brahmo Sabha in Calcutta, which later became known as the Brahmo Samaj.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which reformer used ancient texts to argue that widows could remarry, leading to a law passed in 1856 permitting widow remarriage?",
            options: ["Raja Rammohun Roy", "Ishwarchandra Vidyasagar", "Swami Dayanand Saraswati", "Jyotirao Phule"],
            correct: 1,
            explanation: "Ishwarchandra Vidyasagar used ancient texts to argue for widow remarriage; his suggestion was adopted, resulting in a law passed in 1856.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Swami Dayanand Saraswati, who supported widow remarriage, founded which reform organisation in 1875 that attempted to reform Hinduism?",
            options: ["Brahmo Samaj", "Arya Samaj", "Prarthana Samaj", "Ramakrishna Mission"],
            correct: 1,
            explanation: "Swami Dayanand Saraswati founded the Arya Samaj in 1875, an organisation aimed at reforming Hinduism.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which reformer, educated at home in Poona, wrote a book criticising the social differences between men and women titled 'Stripurushtulna' (A Comparison between Women and Men)?",
            options: ["Pandita Ramabai", "Tarabai Shinde", "Begum Rokeya Sakhawat Hossain", "Rashsundari Debi"],
            correct: 1,
            explanation: "Tarabai Shinde wrote 'Stripurushtulna', criticising the social differences between men and women in society.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Pandita Ramabai, a great scholar of Sanskrit, founded a widows' home at Poona to provide shelter and support to whom?",
            options: [
              "Orphaned children",
              "Widows treated badly by their husbands' relatives",
              "Untouchable factory workers",
              "Muslim women seeking education",
            ],
            correct: 1,
            explanation: "Pandita Ramabai founded a widows' home at Poona to shelter widows treated badly by their husbands' relatives, training them to be economically self-sufficient.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Begum Rokeya Sakhawat Hossain, a fearless critic of conservative ideas, started schools for Muslim girls in which two cities?",
            options: ["Delhi and Lucknow", "Patna and Calcutta", "Aligarh and Lahore", "Bombay and Poona"],
            correct: 1,
            explanation: "Begum Rokeya Sakhawat Hossain started schools for Muslim girls in Patna and Calcutta, criticising the inferior place accorded to women by religious leaders of every faith.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Child Marriage Restraint Act, passed in 1929, initially set the minimum marriage age at 18 for men and what age for women?",
            options: ["14", "16", "18", "21"],
            correct: 1,
            explanation: "The 1929 Act set the minimum age at 18 for men and 16 for women; these limits were later raised to 21 and 18 respectively.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Bombay, an association founded in 1840 that worked for the abolition of caste was called the:",
            options: ["Paramhans Mandali", "Prarthana Samaj", "Veda Samaj", "Satyashodhak Samaj"],
            correct: 0,
            explanation: "The Paramhans Mandali was founded in Bombay in 1840 to work for the abolition of caste; members would secretly violate caste taboos on food and touch.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Jyotirao Phule founded the Satyashodhak Samaj and wrote a book in 1873 titled 'Gulamgiri' (Slavery), dedicated to whom?",
            options: [
              "Indian freedom fighters",
              "Americans who had fought to free slaves",
              "British reformers",
              "Ancient Indian kings",
            ],
            correct: 1,
            explanation: "Phule dedicated his book Gulamgiri to Americans who had fought to free slaves, drawing a parallel between the American Civil War's end of slavery and the plight of 'lower' castes in India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Jyotirao Phule argued that the Aryans were foreigners who came from outside the subcontinent and subjugated the original inhabitants. What did he call the golden age before Aryan rule?",
            options: [
              "A time of warrior-peasants who tilled the land and ruled the Maratha countryside justly",
              "The Vedic age of Brahmanical supremacy",
              "The age of Mughal tolerance",
              "The era of British administration",
            ],
            correct: 0,
            explanation: "Phule claimed that before Aryan rule there existed a golden age when warrior-peasants tilled the land and ruled the Maratha countryside in just and fair ways.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "B.R. Ambedkar, born into a Mahar family, started a temple entry movement in 1927, in which his followers used water from a temple tank. What was Ambedkar's central aim through this movement?",
            options: [
              "To gain financial compensation from temple trusts",
              "To make everyone see the power of caste prejudices within society",
              "To replace Brahman priests with Dalit priests",
              "To abolish temples altogether",
            ],
            correct: 1,
            explanation: "Ambedkar's aim through the temple entry movement, led three times between 1927 and 1935, was to make everyone confront the power of caste prejudice within society.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "E.V. Ramaswamy Naicker, popularly known as Periyar, founded which movement after leaving the Congress in disgust over caste-based seating arrangements at a nationalist feast?",
            options: ["Satyashodhak Samaj", "Self Respect Movement", "Singh Sabha Movement", "Aligarh Movement"],
            correct: 1,
            explanation: "Periyar founded the Self Respect Movement, arguing that untouchables were the true upholders of an original Tamil and Dravidian culture subjugated by Brahmans.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Aligarh Movement, which had a major impact on educational reform among Muslims, was centred on the Mohammedan Anglo-Oriental College founded in 1875 by:",
            options: ["Mumtaz Ali", "Sayyid Ahmed Khan", "Badruddin Tyabji", "Mohammad Ali Jinnah"],
            correct: 1,
            explanation: "Sayyid Ahmed Khan founded the Mohammedan Anglo-Oriental College at Aligarh in 1875, which later became the Aligarh Muslim University.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Singh Sabha Movement, formed at Amritsar in 1873 and Lahore in 1879, sought to rid Sikhism of superstitions and non-Sikh practices, and established which institution in 1892?",
            options: ["Khalsa College, Amritsar", "Aligarh Muslim University", "Hindu College, Benaras", "Fergusson College, Poona"],
            correct: 0,
            explanation: "Leaders of the Singh Sabha movement established Khalsa College, Amritsar, in 1892, combining modern instruction with Sikh teachings.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Henry Louis Vivian Derozio, a teacher at Hindu College Calcutta in the 1820s who promoted radical ideas among his students, is associated with which movement?",
            options: ["Young Bengal Movement", "Aligarh Movement", "Self Respect Movement", "Singh Sabha Movement"],
            correct: 0,
            explanation: "Derozio's students, known as the Young Bengal Movement, attacked tradition and custom, demanded education for women, and campaigned for freedom of thought and expression.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "making-of-national-movement-class8",
        name: "The Making of the National Movement: 1870s-1947 (Class 8)",
        questions: [
          q({
            text: "The Rowlatt Act of 1919, passed despite unanimous opposition from Indian members of the Central Legislative Council, gave the colonial government the power to:",
            options: [
              "Grant Indians the right to vote",
              "Imprison political prisoners without trial for two years",
              "Establish provincial legislatures",
              "Abolish the salt tax",
            ],
            correct: 1,
            explanation: "The Rowlatt Act (1919) gave the government emergency powers to imprison political prisoners without trial for up to two years, provoking nationwide protest and the Rowlatt Satyagraha.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "'Give me blood, and I shall give you freedom' is a famous call given by:",
            options: ["Subhas Chandra Bose", "Bhagat Singh", "Lala Lajpat Rai", "Chandrashekhar Azad"],
            correct: 0,
            explanation: "Subhas Chandra Bose, addressing Indian National Army volunteers, gave the famous call 'Give me blood, and I shall give you freedom.'",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Salt March of 1930, in which Gandhi walked from Sabarmati to Dandi to break the salt law, formally launched the:",
            options: ["Civil Disobedience Movement", "Non-Cooperation Movement", "Quit India Movement", "Khilafat Movement"],
            correct: 0,
            explanation: "Gandhi's Salt March to Dandi in 1930, breaking the government's salt monopoly, launched the Civil Disobedience Movement.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Khudai Khidmatgar (Red Shirts), a movement of Pashtun nationalists in the North-West Frontier Province allied with the Indian National Congress, was led by:",
            options: ["Abdul Ghaffar Khan", "Maulana Azad", "Muhammad Ali Jinnah", "Hakim Ajmal Khan"],
            correct: 0,
            explanation: "The Khudai Khidmatgar movement in the North-West Frontier Province was founded and led by Khan Abdul Ghaffar Khan, popularly known as 'Frontier Gandhi'.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which statement about the First Round Table Conference (1930) is correct?",
            options: [
              "The Indian National Congress did not participate, though representatives of the princely states did attend",
              "The Indian National Congress led the conference proceedings",
              "It was held after the Poona Pact",
              "It resulted in the immediate grant of Dominion Status",
            ],
            correct: 0,
            explanation: "The Indian National Congress boycotted the First Round Table Conference (1930) as it was then engaged in the Civil Disobedience Movement, though representatives of the Indian princely states did participate.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Khilafat Movement (1919-1922), which Mahatma Gandhi supported and merged with the Non-Cooperation Movement, was started by which two brothers?",
            options: [
              "Mohammad Ali and Shaukat Ali",
              "Abdul Ghaffar Khan and his brother",
              "Maulana Azad and Hakim Ajmal Khan",
              "Liaquat Ali Khan and Zafar Ali Khan",
            ],
            correct: 0,
            explanation: "The Khilafat Movement was started by the brothers Mohammad Ali and Shaukat Ali to pressure the British government over the treatment of the Ottoman Caliph after the First World War.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "In which movement, launched by Gandhi in 1920, did non-cooperation with British rule first become a mass, all-India programme?",
            options: ["The Non-Cooperation Movement", "The Bardoli Satyagraha", "The Quit India Movement", "The Civil Disobedience Movement"],
            correct: 0,
            explanation: "Gandhi launched the Non-Cooperation Movement in 1920, calling on Indians to withdraw cooperation from British institutions, schools, courts and legislatures as a mass programme of protest.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Indian National Congress passed its resolution on Fundamental Rights and the National Economic Programme at which session, presided over by Jawaharlal Nehru?",
            options: ["Karachi Session, 1931", "Lahore Session, 1929", "Lucknow Session, 1936", "Haripura Session, 1938"],
            correct: 0,
            explanation: "At the Karachi Session of 1931, the Congress adopted a resolution on Fundamental Rights and the National Economic Programme, reflecting a growing concern with social and economic issues alongside political freedom.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Vernacular Press Act of 1878 allowed the government to confiscate the assets of newspapers, including their printing presses, for publishing content found to be:",
            options: ["Untrue", "Objectionable", "Anti-religious", "Foreign-funded"],
            correct: 1,
            explanation: "The Vernacular Press Act of 1878 allowed confiscation of a newspaper's assets if it published anything the government found 'objectionable', silencing critics.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The controversy over the 1883 Ilbert Bill, which provided for the trial of British or European persons by Indian judges, was significant because it:",
            options: [
              "Was welcomed unanimously by the British in India",
              "Highlighted the racial attitudes of the British after white opposition forced its withdrawal",
              "Led to the immediate independence of India",
              "Was proposed by Indian nationalists",
            ],
            correct: 1,
            explanation: "When white opposition forced the government to withdraw the Ilbert Bill, Indians were enraged, and the episode highlighted the deep racial attitudes of the British in India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Indian National Congress was established in December 1885 when 72 delegates from all over the country met in which city?",
            options: ["Calcutta", "Bombay", "Madras", "Delhi"],
            correct: 1,
            explanation: "The Indian National Congress was established at a meeting of 72 delegates in Bombay in December 1885.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which retired British official played a part in bringing Indians from various regions together to found the Indian National Congress?",
            options: ["Lord Dalhousie", "A.O. Hume", "Lord Curzon", "Lord Ripon"],
            correct: 1,
            explanation: "A.O. Hume, a retired British official, played a role in bringing together Indians from various regions to form the Indian National Congress.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Dadabhai Naoroji, an early Congress leader and businessman based in London, wrote a book offering a scathing criticism of the economic impact of British rule, titled:",
            options: [
              "Hind Swaraj",
              "Poverty and Un-British Rule in India",
              "The Discovery of India",
              "India Wins Freedom",
            ],
            correct: 1,
            explanation: "Dadabhai Naoroji's book 'Poverty and Un-British Rule in India' offered a scathing economic critique of British colonial policy.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During its first twenty years, the Indian National Congress is often described as 'Moderate' in its objectives and methods. What is one demand it raised during this phase?",
            options: [
              "Complete and immediate independence",
              "Civil service examinations to be held in India as well, not just in London",
              "Armed uprising against British rule",
              "Partition of India along religious lines",
            ],
            correct: 1,
            explanation: "The Moderate-era Congress demanded, among other things, civil service examinations be held in India, greater representation in Legislative Councils, and reduction of military expenditure.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Bal Gangadhar Tilak's famous slogan, associated with the more radical wing of the Congress by the 1890s, was:",
            options: [
              "\"Do or Die\"",
              "\"Freedom is my birthright and I shall have it!\"",
              "\"Inquilab Zindabad\"",
              "\"Quit India\"",
            ],
            correct: 1,
            explanation: "Tilak raised the slogan 'Freedom is my birthright and I shall have it!', reflecting the radicals' emphasis on self-reliance rather than the Moderates' 'politics of prayers'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The 1905 Partition of Bengal by Viceroy Curzon led to a mass movement known as the Swadeshi movement, which in deltaic Andhra was known as the:",
            options: ["Vandemataram Movement", "Khilafat Movement", "Home Rule Movement", "Non-Cooperation Movement"],
            correct: 0,
            explanation: "The Swadeshi movement, strongest in Bengal, had echoes elsewhere — in deltaic Andhra, it was known as the Vandemataram Movement.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The All India Muslim League, formed by a group of Muslim landlords and nawabs at Dacca in 1906, supported the partition of Bengal and desired what political provision, conceded by the government in 1909?",
            options: ["A separate country", "Separate electorates for Muslims", "Reservation in the army", "Control over the judiciary"],
            correct: 1,
            explanation: "The Muslim League desired separate electorates for Muslims, a demand conceded by the government in 1909, reserving some council seats for Muslim voters.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Congress split in 1907 between the Moderates and the Radicals (Tilak's followers), and reunited in which year, followed by the historic Lucknow Pact with the Muslim League?",
            options: ["1909", "1915", "1919", "1922"],
            correct: 1,
            explanation: "The two groups reunited in December 1915, and the following year the Congress and Muslim League signed the Lucknow Pact to work together for representative government.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahatma Gandhi's first interventions in India after returning from South Africa in 1915 were in local movements in Champaran, Kheda, and which city, where he led a successful millworkers' strike in 1918?",
            options: ["Bombay", "Ahmedabad", "Surat", "Baroda"],
            correct: 1,
            explanation: "Gandhi's early interventions included Champaran, Kheda, and Ahmedabad, where he led a successful millworkers' strike in 1918.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Rowlatt Act of 1919, which curbed fundamental rights and strengthened police powers, prompted Gandhiji to call for a nationwide 'hartal' and day of 'humiliation and prayer' on which date?",
            options: ["13 April 1919", "6 April 1919", "1 August 1920", "12 March 1930"],
            correct: 1,
            explanation: "Gandhiji called for 6 April 1919 to be observed as a day of non-violent hartal against the 'devilish' Rowlatt Act.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Jallianwala Bagh massacre, carried out by General Dyer in Amritsar, took place on Baisakhi day, which fell on:",
            options: ["6 April 1919", "13 April 1919", "1 May 1919", "9 May 1919"],
            correct: 1,
            explanation: "The Jallianwala Bagh atrocities occurred on Baisakhi day, 13 April 1919, leading Rabindranath Tagore to renounce his knighthood in protest.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Khilafat agitation, led by Mohammad Ali and Shaukat Ali, was aimed at protecting the position of the Khalifa (Turkish Sultan) after a harsh treaty was imposed by which power?",
            options: ["France", "The British", "Germany", "Italy"],
            correct: 1,
            explanation: "The British imposed a harsh treaty on the Turkish Sultan or Khalifa in 1920, angering Indian Muslims and leading to the Khilafat agitation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahatma Gandhi abruptly called off the Non-Cooperation Movement in February 1922 after which violent incident?",
            options: [
              "The Jallianwala Bagh massacre",
              "The Chauri Chaura incident, where a crowd set fire to a police station killing 22 policemen",
              "The assassination of Lala Lajpat Rai",
              "The bombing of the Central Legislative Assembly",
            ],
            correct: 1,
            explanation: "Gandhi called off the Non-Cooperation Movement after the Chauri Chaura incident in February 1922, where peasants set fire to a police station, killing 22 policemen.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Hindustan Socialist Republican Association (HSRA), founded in 1928 by revolutionaries like Bhagat Singh and Chandra Shekhar Azad, assassinated the police officer Saunders in December 1928 in response to:",
            options: [
              "The Jallianwala Bagh massacre",
              "The lathi-charge that caused the death of Lala Lajpat Rai",
              "The Rowlatt Act",
              "The partition of Bengal",
            ],
            correct: 1,
            explanation: "Bhagat Singh, Azad and Rajguru assassinated Saunders, the police officer involved in the lathi-charge that killed Lala Lajpat Rai during a protest against the Simon Commission.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On 8 April 1929, Bhagat Singh and B.K. Dutt threw a bomb in the Central Legislative Assembly, explaining in their leaflet that their aim was not to kill but to:",
            options: ["Damage government property", "Make the deaf hear", "Start a civil war", "Assassinate the Viceroy"],
            correct: 1,
            explanation: "Their leaflet explained the bombing's aim was 'to make the deaf hear' and remind the government of its exploitation, not to kill anyone.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Congress resolved to fight for 'Purna Swaraj' (complete independence) in 1929 under the presidentship of which leader, with Independence Day observed on 26 January 1930?",
            options: ["Mahatma Gandhi", "Jawaharlal Nehru", "Sardar Patel", "C. Rajagopalachari"],
            correct: 1,
            explanation: "Jawaharlal Nehru presided over the 1929 Congress session that resolved to fight for Purna Swaraj, with 26 January 1930 observed as Independence Day.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Gandhiji's 1930 Salt March covered over 240 miles from Sabarmati to which coastal town, where he broke the salt law?",
            options: ["Surat", "Dandi", "Porbandar", "Diu"],
            correct: 1,
            explanation: "Gandhiji and his followers marched over 240 miles from Sabarmati to Dandi, where they broke the salt law by making salt from seawater on 6 April 1930.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Who persuaded Mahatma Gandhi, initially opposed to women's participation in the Salt Satyagraha, to allow women to join the movement?",
            options: ["Kasturba Gandhi", "Sarojini Naidu", "Begum Hazrat Mahal", "Pandita Ramabai"],
            correct: 1,
            explanation: "Sarojini Naidu persuaded Gandhi to allow women's participation in the Salt Satyagraha; she later became the first Indian woman President of the Indian National Congress in 1925.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Government of India Act of 1935 prescribed provincial autonomy, and elections held in 1937 saw the Congress form governments in how many out of 11 provinces?",
            options: ["3", "5", "7", "9"],
            correct: 2,
            explanation: "The Congress formed governments in 7 out of 11 provinces after the 1937 provincial elections held under the 1935 Act.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Subhas Chandra Bose, who did not share Gandhiji's ideal of ahimsa, left Calcutta in January 1941 and later raised the Azad Hind Fauj, also known as the:",
            options: ["Hindustan Socialist Republican Association", "Indian National Army (INA)", "Khudai Khidmatgars", "Rashtriya Swayamsevak Sangh"],
            correct: 1,
            explanation: "Subhas Chandra Bose raised the Azad Hind Fauj, or Indian National Army (INA), which tried to enter India through Imphal and Kohima in 1944, though the campaign failed.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the Quit India Movement of 1942, Gandhiji's call to the people was to:",
            options: ["\"Freedom at any cost\"", "\"Do or die\", but fight non-violently", "\"Direct Action\"", "\"Swaraj is my birthright\""],
            correct: 1,
            explanation: "Gandhiji told the people to 'do or die' in their effort to fight the British, but insisted the struggle must remain non-violent.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Khan Abdul Ghaffar Khan, also known as Badshah Khan, founded which non-violent movement among the Pathans of the North West Frontier Province?",
            options: ["Khudai Khidmatgars", "Akali movement", "Self Respect Movement", "Satyashodhak Samaj"],
            correct: 0,
            explanation: "Badshah Khan founded the Khudai Khidmatgars, a powerful non-violent movement among the Pathans, and was strongly opposed to the Partition of India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Muslim League announced 16 August 1946 as 'Direct Action Day' after the failure of the Cabinet Mission, leading to communal riots that broke out first in which city?",
            options: ["Delhi", "Lahore", "Calcutta", "Bombay"],
            correct: 2,
            explanation: "Riots broke out in Calcutta on Direct Action Day (16 August 1946), lasting several days and resulting in thousands of deaths, before spreading to northern India by March 1947.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "india-after-independence-class8",
        name: "India After Independence (Class 8)",
        questions: [
          q({
            text: "How many refugees are estimated to have come into India from what was now Pakistan as a result of Partition?",
            options: ["1 million", "3 million", "8 million", "15 million"],
            correct: 2,
            explanation: "As a result of Partition, about 8 million refugees came into India from Pakistan, needing to be found homes and jobs.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahatma Gandhi was assassinated on 30 January 1948 by Nathuram Godse, who disagreed with Gandhiji's conviction that:",
            options: [
              "India should remain under British rule",
              "Hindus and Muslims should live together in harmony",
              "India should adopt a socialist economy",
              "Untouchability should continue",
            ],
            correct: 1,
            explanation: "Godse assassinated Gandhi because he disagreed with Gandhi's conviction that Hindus and Muslims should live together in harmony.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Indian Constitution, framed by the Constituent Assembly between December 1946 and November 1949, came into effect on:",
            options: ["15 August 1947", "26 January 1950", "26 November 1949", "2 October 1950"],
            correct: 1,
            explanation: "The Indian Constitution came into effect on 26 January 1950, though it was adopted by the Constituent Assembly on 26 November 1949.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "One revolutionary feature of the Indian Constitution was its adoption of universal adult franchise from the very start, unlike the UK and USA where voting rights were extended in stages. What was the minimum voting age set at?",
            options: ["18 years", "21 years", "25 years", "30 years"],
            correct: 1,
            explanation: "All Indians above the age of 21 were granted the right to vote in state and national elections from the outset, a revolutionary step compared to other democracies.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Who served as Chairman of the Drafting Committee of the Constituent Assembly, under whose supervision the Indian Constitution was finalised?",
            options: ["Jawaharlal Nehru", "Sardar Vallabhbhai Patel", "Dr B.R. Ambedkar", "Rajendra Prasad"],
            correct: 2,
            explanation: "Dr B.R. Ambedkar served as Chairman of the Drafting Committee, playing perhaps the most important role in finalising the Constitution.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In his final speech to the Constituent Assembly, Dr Ambedkar warned that India was entering a 'life of contradictions' because:",
            options: [
              "It would have both a President and a Prime Minister",
              "Political equality (one man, one vote) would coexist with continuing social and economic inequality",
              "It would have both English and Hindi as official languages",
              "It would have a federal structure with strong states",
            ],
            correct: 1,
            explanation: "Ambedkar warned that in politics India would recognise equality (one man, one vote), but in social and economic life inequality would continue due to the existing social and economic structure.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Indian Constitution divided subjects between the Centre and the states through three lists. Which list contained subjects like forests and agriculture, under the joint responsibility of the Centre and states?",
            options: ["Union List", "State List", "Concurrent List", "Residuary List"],
            correct: 2,
            explanation: "The Concurrent List included subjects like forests and agriculture, over which both the Centre and the states had joint responsibility.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The debate over language in the Constituent Assembly was resolved by a compromise under which Hindi became the:",
            options: [
              "Sole national language, replacing all others",
              "'Official language' of India, while English continued to be used in courts and inter-state communication",
              "Only language taught in schools",
              "Language used exclusively in the Constitution",
            ],
            correct: 1,
            explanation: "The compromise made Hindi the 'official language' of India, while English would continue to be used in the courts, services, and communications between states.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Gandhian leader died after a 58-day hunger strike in December 1952, demanding the formation of a separate state for Telugu speakers?",
            options: ["Potti Sriramulu", "Vinoba Bhave", "C. Rajagopalachari", "Rajendra Prasad"],
            correct: 0,
            explanation: "Potti Sriramulu died on 15 December 1952, 58 days into his fast; the resulting protests forced the government to create the state of Andhra in October 1953.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The States Reorganisation Commission, which submitted its report in 1956, recommended redrawing boundaries to form provinces based on which criterion?",
            options: ["Religion", "Language", "Economic development level", "Historical princely state boundaries"],
            correct: 1,
            explanation: "The States Reorganisation Commission recommended forming compact provinces of Assamese, Bengali, Oriya, Tamil, Malayalam, Kannada and Telugu speakers on a linguistic basis.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1966, the state of Punjab was divided into Punjab and Haryana, with Punjab formed mainly for speakers of which language?",
            options: ["Hindi", "Haryanvi", "Punjabi", "Urdu"],
            correct: 2,
            explanation: "In 1966, Punjab was divided into Punjab (for Punjabi speakers, mostly Sikhs) and Haryana (for Haryanvi/Hindi speakers).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Planning Commission, set up in 1950 to design and execute policies for economic development, promoted a model in which both the state and private sector played complementary roles, known as the:",
            options: ["Command economy model", "Mixed economy model", "Laissez-faire model", "Cooperative economy model"],
            correct: 1,
            explanation: "The 'mixed economy' model gave both the State and the private sector important and complementary roles in production and job creation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Second Five Year Plan, formulated in 1956, focused strongly on the development of:",
            options: ["Agriculture and irrigation only", "Heavy industries such as steel, and large dams", "Tourism and services", "Foreign trade exclusively"],
            correct: 1,
            explanation: "The Second Five Year Plan focused strongly on heavy industries such as steel and the building of large dams, under significant state control.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India's foreign policy after independence, developed by Prime Minister Jawaharlal Nehru, was built on the bedrock of:",
            options: ["Alignment with the USA", "Alignment with the USSR", "Non-alignment", "Isolationism"],
            correct: 2,
            explanation: "Non-alignment formed the bedrock of India's foreign policy, urging countries not to join either of the Cold War's two major alliances while playing an active mediating role.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The 1955 conference at Bandung, Indonesia, brought together leaders of over 29 newly independent states to discuss how to continue opposing colonialism. This reflected which broader movement?",
            options: ["The Non-Aligned Movement", "The Commonwealth", "The United Nations", "SAARC"],
            correct: 0,
            explanation: "The Bandung Conference (1955) was a key moment in the emergence of the Non-Aligned Movement, involving newly independent Afro-Asian nations.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1956, Sri Lanka (then Ceylon) passed an Act recognising which language as the sole official language, provoking opposition from the Tamil-speaking minority?",
            options: ["Tamil", "English", "Sinhala", "Hindi"],
            correct: 2,
            explanation: "The 1956 Act made Sinhala the sole official language of Ceylon, becoming a major grievance for the Tamil-speaking minority and a root cause of the later civil war.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the chapter, why did India, unlike Sri Lanka and Pakistan, manage to survive as a single nation despite its linguistic diversity?",
            options: [
              "Because it banned all regional languages",
              "Because regional languages were given freedom to flourish, easing fears of any single language being imposed",
              "Because it had no linguistic diversity",
              "Because English was made the sole official language",
            ],
            correct: 1,
            explanation: "Unlike Urdu being imposed on East Pakistan or Sinhala on Sri Lankan Tamils, India's regional languages were allowed to flourish, which the chapter argues deepened rather than threatened national unity.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "french-revolution-class9",
        name: "The French Revolution (Class 9)",
        questions: [
          q({
            text: "In 1787, Louis XVI banished members of the Parlement of Paris after they refused to accept his financial reforms. To which town were they exiled?",
            options: ["Troyes", "Orleans", "Lyon", "Reims"],
            correct: 0,
            explanation: "In 1787, when the Parlement of Paris refused to ratify the king's new taxation edicts, Louis XVI exiled its members to the small town of Troyes, a move that provoked further protest.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following events of the French Revolution actually took place in the year stated: 'The Declaration of the Rights of Man and Citizen was adopted in 1789'?",
            options: [
              "This statement alone is correct; the reform of the clergy and abolition of the first anniversary of the Bastille's fall are wrongly dated",
              "All three statements about 1787, 1788 and 1789 are correct",
              "None of the statements are correct",
              "Only the abolition of feudal dues in 1789 is correct",
            ],
            correct: 0,
            explanation: "The Declaration of the Rights of Man and Citizen was indeed adopted in August 1789. The civil constitution reorganising the clergy was passed in 1790, and the first anniversary celebration of the fall of the Bastille (Festival of Federation) was held in July 1790, not 1787/1788.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Jean Sylvain Bailly was elected President of which body formed by representatives of the Third Estate in 1789?",
            options: ["The Estates General", "The National Assembly", "The Constituent Assembly", "The Convention"],
            correct: 1,
            explanation: "When the Third Estate, refused separate voting by estate, declared itself a National Assembly in June 1789, the astronomer Jean Sylvain Bailly was elected its President.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "On the morning of 14 July 1789, a crowd of Parisians stormed which fortress-prison in search of hoarded ammunition?",
            options: ["The Louvre", "The Bastille", "Versailles", "Notre Dame"],
            correct: 1,
            explanation: "The Bastille was stormed on 14 July 1789; though it held only seven prisoners, it was hated as a symbol of the despotic power of the king.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "French society under the Old Regime was divided into three estates. Which estate alone was required to pay taxes to the state?",
            options: ["The First Estate (clergy)", "The Second Estate (nobility)", "The Third Estate", "All three estates equally"],
            correct: 2,
            explanation: "Only members of the Third Estate paid taxes; the clergy and nobility enjoyed exemption from taxation by birth.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The direct tax paid by the Third Estate to the French state was called the taille, while the tax paid to the Church, comprising one-tenth of agricultural produce, was called the:",
            options: ["Corvee", "Tithe", "Gabelle", "Livre"],
            correct: 1,
            explanation: "The tithe was a Church tax comprising one-tenth of agricultural produce; the taille was the direct tax paid to the state.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which two Enlightenment philosophers most directly influenced revolutionary ideas of government — one proposing a social contract, the other a separation of power between legislative, executive and judiciary?",
            options: [
              "John Locke and Montesquieu",
              "Rousseau and Montesquieu",
              "Voltaire and Locke",
              "Robespierre and Rousseau",
            ],
            correct: 1,
            explanation: "Rousseau proposed government based on a social contract, while Montesquieu, in 'The Spirit of the Laws', proposed a division of power between the legislature, executive and judiciary.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On 20 June 1789, representatives of the Third Estate assembled in an indoor tennis court at Versailles and swore not to disperse until they had drafted a constitution. This came to be known as the:",
            options: ["The Tennis Court Oath", "The Great Fear", "The Reign of Terror", "The Fall of the Bastille"],
            correct: 0,
            explanation: "The Tennis Court Oath was sworn on 20 June 1789 by Third Estate representatives who declared themselves a National Assembly.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The rumour that lords of the manor had hired bands of brigands to destroy ripe crops caused peasants in several districts to attack chateaux and burn manorial records. This episode is known as:",
            options: ["The Great Fear", "The Night of Broken Glass", "The Reign of Terror", "The Directory"],
            correct: 0,
            explanation: "The 'Great Fear' spread through the countryside in the summer of 1789 as peasants, gripped by rumours, attacked chateaux and destroyed feudal records.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Constitution of 1791 divided French citizens into 'active citizens', who had the right to vote, and 'passive citizens', who did not. Who qualified as active citizens?",
            options: [
              "All adult men and women",
              "Only men above 25 years who paid taxes equal to at least three days of a labourer's wage",
              "Only members of the clergy and nobility",
              "Only literate citizens",
            ],
            correct: 1,
            explanation: "Only men above 25 who paid a minimum tax were classed as active citizens with voting rights; the remaining men and all women were passive citizens.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Constitution of 1791 began with a document establishing rights such as life, freedom of speech and equality before law as 'natural and inalienable'. This was called the:",
            options: [
              "Declaration of the Rights of Man and Citizen",
              "Declaration of Independence",
              "Bill of Rights",
              "Magna Carta",
            ],
            correct: 0,
            explanation: "The Declaration of the Rights of Man and Citizen established natural and inalienable rights that the state was duty-bound to protect.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The most successful political club during the radical phase of the revolution, whose members included small shopkeepers, artisans and daily-wage workers under the leadership of Robespierre, was the:",
            options: ["Girondins", "Jacobins", "Directory", "Sans-culottes Assembly"],
            correct: 1,
            explanation: "The Jacobin Club, named after the former Convent of St Jacob in Paris, was led by Maximilian Robespierre and drew support from less prosperous sections of society.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Jacobin supporters who wore long striped trousers similar to dock workers, to distinguish themselves from aristocrats in knee breeches, were known as:",
            options: ["Girondins", "Sans-culottes", "Directors", "Emigres"],
            correct: 1,
            explanation: "'Sans-culottes' literally means 'those without knee breeches' — Jacobin supporters who adopted working-class dress to signal the end of aristocratic privilege.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On 21 September 1792, the newly elected Convention abolished the monarchy and declared France a republic. Louis XVI was executed on charges of treason on:",
            options: ["14 July 1789", "20 June 1789", "21 January 1793", "9 Thermidor 1794"],
            correct: 2,
            explanation: "Louis XVI was executed on 21 January 1793 at the Place de la Concorde, after France was declared a republic in September 1792.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The period from 1793 to 1794, during which Robespierre's government pursued a policy of severe control and punishment against 'enemies' of the republic through the guillotine, is known as:",
            options: ["The Directory", "The Reign of Terror", "The Thermidorian Reaction", "The Consulate"],
            correct: 1,
            explanation: "The Reign of Terror (1793-94) saw Robespierre's government arrest, try and guillotine those deemed enemies of the republic, until Robespierre himself was executed in July 1794.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "After the fall of the Jacobin government, a new constitution created an executive of five members, meant as a safeguard against concentration of power in one person. This executive was called the:",
            options: ["The Convention", "The Directory", "The Estates General", "The National Assembly"],
            correct: 1,
            explanation: "The Directory, an executive of five members appointed by two elected legislative councils, ruled France after the Jacobins fell; its instability paved the way for Napoleon.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The most famous women's political club during the French Revolution, which campaigned for women to enjoy the same political rights as men, was the:",
            options: [
              "Society of Revolutionary and Republican Women",
              "Jacobin Women's League",
              "National Assembly of Women",
              "Sans-culottes Sisterhood",
            ],
            correct: 0,
            explanation: "The Society of Revolutionary and Republican Women was the most famous of about sixty women's clubs formed to voice women's political interests during the revolution.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which revolutionary woman wrote the 'Declaration of the Rights of Woman and Citizen' in 1791 and was later executed for criticising the Jacobin government's closure of women's clubs?",
            options: ["Marie Antoinette", "Olympe de Gouges", "Charlotte Corday", "Madame Roland"],
            correct: 1,
            explanation: "Olympe de Gouges wrote the Declaration of the Rights of Woman and Citizen in 1791 and was tried and executed by the National Convention on charges of treason in 1793.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In what year did women in France finally win the right to vote, following a struggle that began during the revolutionary years?",
            options: ["1848", "1918", "1946", "1971"],
            correct: 2,
            explanation: "Women in France finally won the right to vote in 1946, nearly two centuries after their revolutionary-era struggle for political rights began.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Jacobin regime's abolition of slavery in French colonies in 1794 was reversed ten years later. Who reintroduced slavery in the French overseas possessions?",
            options: ["Robespierre", "Louis XVI", "Napoleon Bonaparte", "Louis Philippe"],
            correct: 2,
            explanation: "Napoleon reintroduced slavery in French colonies ten years after the Convention had abolished it in 1794; slavery was finally abolished for good in French colonies in 1848.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1804, who crowned himself Emperor of France, going on to introduce laws protecting private property and a uniform decimal system of weights and measures, before being finally defeated at Waterloo in 1815?",
            options: ["Robespierre", "Louis XVI", "Napoleon Bonaparte", "Mirabeau"],
            correct: 2,
            explanation: "Napoleon Bonaparte crowned himself Emperor in 1804 and was finally defeated at the Battle of Waterloo in 1815, having carried revolutionary legal ideas across much of Europe.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which two individuals are cited in the chapter as examples of Indians who responded to the ideas coming from revolutionary France?",
            options: [
              "Bal Gangadhar Tilak and Dadabhai Naoroji",
              "Tipu Sultan and Raja Rammohan Roy",
              "Jawaharlal Nehru and Subhas Chandra Bose",
              "Ishwarchandra Vidyasagar and Jyotirao Phule",
            ],
            correct: 1,
            explanation: "Tipu Sultan and Raja Rammohan Roy are cited as individuals whose imagination was excited by the ideas of the French Revolution.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "socialism-europe-russian-revolution-class9",
        name: "Socialism in Europe and the Russian Revolution (Class 9)",
        questions: [
          q({
            text: "Karl Marx argued that industrial society was 'capitalist' because it was dominated by private capitalists, and true socialism could be understood only through a scientific analysis of:",
            options: ["Religion and culture", "History and society", "Foreign policy", "Art and literature"],
            correct: 1,
            explanation: "Karl Marx argued that industrial society was capitalist, and socialists could not fight capitalism without a scientific understanding of history and society, which he set out to provide.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "A society in which the property of a community as a whole rather than of single individuals is called:",
            options: ["Socialist", "Capitalist", "Feudal", "Mercantile"],
            correct: 0,
            explanation: "A socialist society is one based on collective or community ownership of property and the means of production, rather than private ownership by individuals.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which political party led the Russian Revolution of 1917, rather than the later Communist Party of the Russian Federation?",
            options: [
              "The Russian Social Democratic Labour Party",
              "The Communist Party of the Russian Federation",
              "The Constitutional Democratic Party",
              "The Socialist Revolutionary Party alone",
            ],
            correct: 0,
            explanation: "The Russian Social Democratic Labour Party, which later split into Bolshevik and Menshevik factions, led the movement that culminated in the 1917 Revolution; the Communist Party of the Russian Federation was formed only after the Soviet Union's collapse in 1991.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Russian Revolution of 1917 is generally described as unfolding in which two stages?",
            options: [
              "The February Revolution and the October Revolution",
              "The Bloody Sunday uprising and the Civil War",
              "The 1905 Revolution and the 1917 Revolution only",
              "The Decembrist revolt and the October Revolution",
            ],
            correct: 0,
            explanation: "The Russian Revolution of 1917 occurred in two stages: the February Revolution, which overthrew the Tsar, and the October Revolution, which brought the Bolsheviks to power.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The revolution that began with a bread shortage in Petrograd, leading to strikes and the abdication of the Tsar, is known as the:",
            options: ["February Revolution", "October Revolution", "Bloody Sunday", "Decembrist Revolt"],
            correct: 0,
            explanation: "In February 1917, food shortages and strikes in Petrograd, joined by soldiers, forced Tsar Nicholas II to abdicate — an event known as the February Revolution.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Historical materialism, the theory that a society's economic base shapes its social and political structure, was propounded by:",
            options: ["Karl Marx", "Adam Smith", "Robert Owen", "Charles Fourier"],
            correct: 0,
            explanation: "Karl Marx developed the theory of historical materialism, arguing that the economic mode of production forms the base which determines a society's social, political and ideological structures.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Friedrich Engels is best known as the close collaborator of which political philosopher, with whom he co-authored 'The Communist Manifesto'?",
            options: ["Karl Marx", "Vladimir Lenin", "Leon Trotsky", "Robert Owen"],
            correct: 0,
            explanation: "Friedrich Engels collaborated closely with Karl Marx, and together they wrote 'The Communist Manifesto' (1848), a foundational text of scientific socialism.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The theory of Scientific Socialism was propounded in which of the following books?",
            options: ["The Communist Manifesto", "Das Kapital alone", "The Wealth of Nations", "New View of Society"],
            correct: 0,
            explanation: "Marx and Engels laid out the theory of Scientific Socialism in 'The Communist Manifesto' (1848), which argued that capitalism would inevitably be overthrown by the working class.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Vladimir Lenin's pamphlet on party organisation and revolutionary strategy, translated as 'What Is To Be Done?', is also known by which subtitle?",
            options: [
              "Burning Questions of Our Movement",
              "The State and Revolution",
              "Imperialism, the Highest Stage of Capitalism",
              "Two Tactics of Social Democracy",
            ],
            correct: 0,
            explanation: "Lenin's 1902 pamphlet 'What Is To Be Done? Burning Questions of Our Movement' argued for a disciplined party of professional revolutionaries to lead the working class.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Which political group of the nineteenth century wanted a nation based on the majority of the population, opposed the privileges of great landowners, and supported women's suffragette movements, while not opposing private property outright?",
            options: ["Conservatives", "Liberals", "Radicals", "Autocrats"],
            correct: 2,
            explanation: "Radicals wanted government based on the majority of the population and opposed concentration of property, unlike liberals who favoured voting rights mainly for men of property.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which socialist thinker sought to build a cooperative community called New Harmony in Indiana, USA?",
            options: ["Karl Marx", "Friedrich Engels", "Robert Owen", "Louis Blanc"],
            correct: 2,
            explanation: "Robert Owen, a leading English manufacturer, sought to build the cooperative community of New Harmony in Indiana, USA.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to Karl Marx, workers had to overthrow capitalism and construct a radically socialist society where all property was socially controlled. What did Marx call this future society?",
            options: ["A liberal society", "A communist society", "A conservative utopia", "A cooperative federation"],
            correct: 1,
            explanation: "Marx believed workers would triumph over capitalists and construct a communist society, where property would be socially controlled rather than privately owned.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "By the 1870s, socialists formed an international body to coordinate their efforts across Europe, known as the:",
            options: ["Comintern", "Second International", "League of Nations", "Congress of Soviets"],
            correct: 1,
            explanation: "Socialists formed the Second International by the 1870s to coordinate their efforts across Europe.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "About what percentage of the Russian empire's population earned their living from agriculture at the beginning of the twentieth century — a proportion much higher than in France or Germany?",
            options: ["40 per cent", "60 per cent", "85 per cent", "95 per cent"],
            correct: 2,
            explanation: "About 85 per cent of the Russian empire's population were agriculturists, compared to 40-50 per cent in France and Germany.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Russian peasant custom of periodically pooling and redistributing land according to family needs was organised through a body known as the:",
            options: ["Duma", "Mir (commune)", "Soviet", "Zemstvo"],
            correct: 1,
            explanation: "The Russian peasant commune, known as the 'mir', periodically pooled land and divided it according to the needs of individual families.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Russian Social Democratic Workers Party, founded in 1898 by socialists who respected Marx's ideas, later split into two factions. Which faction, led by Lenin, believed the party should be disciplined and control the number and quality of its members?",
            options: ["Mensheviks", "Bolsheviks", "Socialist Revolutionaries", "Cadets"],
            correct: 1,
            explanation: "The Bolsheviks, led by Lenin, believed in a disciplined party with controlled membership, unlike the Mensheviks who wanted the party open to all.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The incident in which over 100 workers were killed when a procession led by Father Gapon was attacked by police and Cossacks near the Winter Palace, sparking the 1905 Revolution, is known as:",
            options: ["Bloody Sunday", "The February Revolution", "The July Days", "The Great Fear"],
            correct: 0,
            explanation: "'Bloody Sunday' (1905) — the massacre of a peaceful workers' procession near the Winter Palace — triggered the wider 1905 Revolution.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "During the 1905 Revolution, the Tsar allowed the creation of an elected consultative Parliament, which he later dismissed within 75 days when it questioned his authority. This parliament was called the:",
            options: ["Soviet", "Duma", "Comintern", "Zemstvo"],
            correct: 1,
            explanation: "The Duma was the elected consultative parliament created during the 1905 Revolution, repeatedly dismissed by the Tsar when it proved inconvenient.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which event of February 1917, beginning with a lockout at a factory and swelling into citywide strikes involving International Women's Day demonstrations, led to the abdication of Tsar Nicholas II?",
            options: ["The October Revolution", "The February Revolution", "The Civil War", "The Bloody Sunday massacre"],
            correct: 1,
            explanation: "The February Revolution began with strikes in Petrograd (led in part by women workers on International Women's Day) and culminated in the Tsar's abdication on 2 March 1917.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After the February Revolution, workers' and soldiers' councils were formed across Russia. What were these councils called?",
            options: ["Dumas", "Soviets", "Zemstvos", "Mirs"],
            correct: 1,
            explanation: "'Soviets' were councils of workers and soldiers formed across Russia after the February Revolution, the most influential being the Petrograd Soviet.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In April 1917, Lenin returned from exile and put forward three demands — that the war be ended, land be transferred to peasants, and banks be nationalised. These were known as:",
            options: ["The April Theses", "The February Manifesto", "The Petrograd Programme", "The Bolshevik Charter"],
            correct: 0,
            explanation: "Lenin's April Theses called for ending the war, transferring land to peasants, and nationalising banks, and argued the Bolshevik Party should adopt these radical aims.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Bolshevik seizure of power beginning on 24 October 1917, in which the ship Aurora shelled the Winter Palace, is remembered as the:",
            options: ["February Revolution", "October Revolution", "Reign of Terror", "Thermidorian Reaction"],
            correct: 1,
            explanation: "The October Revolution (24 October 1917 onward) saw the Military Revolutionary Committee, under Leon Trotskii, seize government buildings and the Winter Palace.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "According to the Julian calendar Russia followed until February 1918, the 'October' Revolution actually took place, by the Gregorian calendar used today, on:",
            options: ["12 March", "7 November", "25 October", "1 May"],
            correct: 1,
            explanation: "Russia's Julian calendar dates were 13 days behind the Gregorian calendar, so the 'October' Revolution corresponds to 7 November by today's calendar.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In March 1918, despite opposition from political allies, the Bolsheviks made peace with Germany through which treaty, taking Russia out of the First World War?",
            options: ["Treaty of Versailles", "Treaty of Brest Litovsk", "Treaty of Riga", "Treaty of Tilsit"],
            correct: 1,
            explanation: "The Bolsheviks signed the Treaty of Brest Litovsk with Germany in March 1918, withdrawing Russia from the First World War.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the civil war of 1918-1920, the anti-Bolshevik forces (pro-Tsarists and Socialist Revolutionaries) were popularly referred to by which colour, in contrast to the Bolshevik 'reds'?",
            options: ["Blacks and greens/whites", "Blues", "Golds", "Silvers"],
            correct: 0,
            explanation: "The 'greens' (Socialist Revolutionaries) and 'whites' (pro-Tsarists) fought against the Bolshevik 'reds' during the Russian Civil War of 1918-1920.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Bolshevik government's process of centralised planning, which set economic targets for a five-year period, came to be known as the:",
            options: ["New Economic Policy", "Five Year Plans", "War Communism", "Collective Charter"],
            correct: 1,
            explanation: "Centralised planning under the Bolsheviks took the form of Five Year Plans, which set targets for industrial growth over five-year periods.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Stalin's programme from 1929, which forced peasants to cultivate in large collective farms known as kolkhoz, was aimed at solving grain shortages by eliminating well-to-do peasants known as:",
            options: ["Boyars", "Kulaks", "Mensheviks", "Cossacks"],
            correct: 1,
            explanation: "Stalin's collectivisation programme targeted 'kulaks' (well-to-do peasants), forcing all peasants into collective farms (kolkhoz) from 1929 onward.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The bad harvests of 1930-1933, following the disruption caused by forced collectivisation, led to one of the most devastating famines in Soviet history, in which over how many people died?",
            options: ["1 million", "4 million", "10 million", "25 million"],
            correct: 1,
            explanation: "The bad harvests of 1930-1933, worsened by collectivisation, led to a famine in which over 4 million people died.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Which prominent Indian political and cultural figure, who visited Russia and wrote about Soviet socialism in 1930, noted that 'the whole place belongs to the workers' while observing that Moscow appeared less clean than other European capitals?",
            options: ["Jawaharlal Nehru", "Rabindranath Tagore", "M.N. Roy", "Subhas Chandra Bose"],
            correct: 1,
            explanation: "Rabindranath Tagore wrote this account of his 1930 visit to Soviet Russia, reflecting on how ordinary workers and peasants had come forward under the new system.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "nazism-rise-of-hitler-class9",
        name: "Nazism and the Rise of Hitler (Class 9)",
        questions: [
          q({
            text: "In the German elections of 1928, the Nazi Party polled only 2.6% of the vote. This fact best illustrates that:",
            options: [
              "Nazism was popular from its founding",
              "The Nazi Party won very few votes before the Great Depression struck",
              "The Nazi Party had already banned all other parties",
              "Hitler was already Chancellor by 1928",
            ],
            correct: 1,
            explanation: "Before the Great Depression, Nazi electoral support was minimal — only 2.6% of the vote in 1928. It was the economic collapse after 1929 that dramatically expanded the Party's support base.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The non-aggression pact signed in August 1939, just before the outbreak of the Second World War, was between Germany and which country?",
            options: ["The USSR", "France", "Poland", "Italy"],
            correct: 0,
            explanation: "In August 1939, Nazi Germany and the Soviet Union signed the Molotov-Ribbentrop Non-Aggression Pact, clearing the way for Germany's invasion of Poland the following month.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "In which year did Germany declare itself free of the disarmament clauses imposed by the Treaty of Versailles?",
            options: ["1935", "1933", "1939", "1930"],
            correct: 0,
            explanation: "In 1935, Hitler's Germany unilaterally renounced the disarmament restrictions imposed by the Treaty of Versailles and began open rearmament.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "An ideology holding that the state, not class or individual interest, should organise and control economic and social life is best described as a form of:",
            options: ["Fascism", "Liberalism", "Socialism", "Anarchism"],
            correct: 0,
            explanation: "State corporatism, in which the state organises economic and social life in the name of national unity above class interests, was a defining feature of Fascist ideology in interwar Italy and Germany.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The harsh and humiliating peace treaty imposed on Germany after the First World War, under which Germany lost its overseas colonies, a tenth of its population and 13 per cent of its territories, was the:",
            options: ["Treaty of Brest Litovsk", "Treaty of Versailles", "Treaty of Vienna", "Treaty of Locarno"],
            correct: 1,
            explanation: "The Treaty of Versailles imposed harsh terms on Germany, including territorial losses, demilitarisation and reparations, held responsible under the 'War Guilt Clause'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The democratic constitution established after Germany's defeat in the First World War, with a federal structure and universal adult suffrage, is known as the:",
            options: ["Bonn Constitution", "Weimar Republic", "Frankfurt Assembly", "German Reich"],
            correct: 1,
            explanation: "The Weimar Republic, established by a National Assembly meeting at Weimar, introduced a democratic federal constitution but was seen by many Germans as responsible for the humiliation of Versailles.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The 1923 crisis in which the value of the German mark collapsed so severely that prices soared and people needed cartloads of currency to buy basic goods is known as:",
            options: ["The Great Depression", "Hyperinflation", "The Dust Bowl crisis", "The Ruhr Crisis"],
            correct: 1,
            explanation: "Hyperinflation in 1923 saw the German mark collapse in value after Germany printed money recklessly to counter the French occupation of the Ruhr.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which American plan reworked the terms of German war reparations to ease the financial burden after the 1923 hyperinflation crisis?",
            options: ["Marshall Plan", "Dawes Plan", "Truman Doctrine", "Young Plan"],
            correct: 1,
            explanation: "The Dawes Plan, introduced by American intervention, reworked reparation terms to help stabilise the German economy after hyperinflation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which clause of the Weimar Constitution gave the President the power to impose emergency, suspend civil rights, and rule by decree — a provision Hitler later exploited?",
            options: ["Article 48", "Article 1", "Article 370", "Article 15"],
            correct: 0,
            explanation: "Article 48 of the Weimar Constitution allowed the President to rule by decree during emergencies, a defect that helped destabilise German democracy.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Hitler joined a small group called the German Workers' Party in 1919 and later renamed it. What was this party's new name?",
            options: [
              "German Democratic Party",
              "National Socialist German Workers' Party (Nazi Party)",
              "German Social Democratic Party",
              "German Communist Party",
            ],
            correct: 1,
            explanation: "Hitler renamed the German Workers' Party the National Socialist German Workers' Party, which came to be known as the Nazi Party.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "By 1932, the Nazi Party had grown from just 2.6 per cent of votes in 1928 to become the largest party in the Reichstag with what percentage of votes?",
            options: ["15 per cent", "25 per cent", "37 per cent", "51 per cent"],
            correct: 2,
            explanation: "The Nazi Party won 37 per cent of votes by 1932, up from 2.6 per cent in 1928, becoming the largest party as the Great Depression fuelled its rise.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On 30 January 1933, who offered Hitler the Chancellorship, the highest position in the cabinet of ministers?",
            options: ["Kaiser Wilhelm II", "President Hindenburg", "Chancellor Bruning", "General Ludendorff"],
            correct: 1,
            explanation: "President Hindenburg offered Hitler the Chancellorship on 30 January 1933, after the Nazis had rallied conservative support.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Fire Decree of 28 February 1933, which indefinitely suspended civic rights like freedom of speech, press and assembly, followed a mysterious fire in which building?",
            options: ["The Reichstag (German Parliament)", "The Chancellery", "Auschwitz", "The Brandenburg Gate"],
            correct: 0,
            explanation: "A mysterious fire in the German Parliament (Reichstag) building gave Hitler the pretext to issue the Fire Decree suspending civil liberties.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Act passed on 3 March 1933 that established dictatorship in Germany, giving Hitler all powers to sideline Parliament and rule by decree, was called the:",
            options: ["Nuremberg Laws", "Enabling Act", "War Guilt Clause", "Fire Decree"],
            correct: 1,
            explanation: "The Enabling Act of 3 March 1933 gave Hitler dictatorial powers, allowing him to bypass Parliament and rule by decree.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Hitler's geopolitical concept, referring to the belief that Germany needed to acquire new territories for settlement to enhance its material resources and power, was called:",
            options: ["Lebensraum", "Anschluss", "Blitzkrieg", "Kulturkampf"],
            correct: 0,
            explanation: "Lebensraum ('living space') was Hitler's idea that Germany needed to acquire new territories, particularly to the east, for settlement and resources.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Nuremberg Laws of September 1935 declared that only persons of German or related blood could be citizens, and forbade marriages between Jews and Germans. What was this the first stage of, in the Nazi 'Steps to Death'?",
            options: ["Ghettoisation", "Annihilation", "Exclusion", "Deportation"],
            correct: 2,
            explanation: "The Nuremberg Laws marked 'Stage 1: Exclusion (1933-1939)' in the Nazi process against Jews, before ghettoisation (1940-1944) and annihilation (1941 onwards).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "From September 1941, all Jews were required to wear a yellow badge on their breasts. What symbol was on this badge?",
            options: ["A crescent moon", "The Star of David", "A red triangle", "A black cross"],
            correct: 1,
            explanation: "From September 1941, Jews had to wear a yellow Star of David, stamped on their passports, documents and houses as well.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The event of November 1938, in which Jewish properties were vandalised, synagogues burnt and men arrested in an organised pogrom, is remembered as:",
            options: ["Kristallnacht ('the night of broken glass')", "Bloody Sunday", "The Long Knives", "The Reichstag Fire"],
            correct: 0,
            explanation: "Kristallnacht, 'the night of broken glass' (November 1938), saw synagogues burnt, Jewish businesses vandalised, and men arrested in an organised pogrom.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "At ten years of age, boys in Nazi Germany had to enter which youth organisation, before joining Hitler Youth at 14?",
            options: ["Jungvolk", "SS", "SA", "Gestapo"],
            correct: 0,
            explanation: "Ten-year-old boys entered the Jungvolk, before joining Hitler Youth at age 14 for further ideological and physical training.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under the Nazi 'cult of motherhood', women who produced many racially desirable children were awarded which honour, in bronze, silver or gold depending on the number of children?",
            options: ["Iron Cross", "Honour Cross", "German Eagle Medal", "Blood Order"],
            correct: 1,
            explanation: "Honour Crosses were awarded to mothers of racially desirable children — bronze for four, silver for six, and gold for eight or more.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Nazi propaganda avoided the words 'kill' or 'murder', instead using euphemisms. What was the term used for the mass murder plan targeting Jews?",
            options: ["Special treatment", "Final solution", "Selection", "Both 'special treatment' and 'final solution' were used"],
            correct: 3,
            explanation: "The Nazis used deceptive euphemisms including 'special treatment' and the 'final solution' (for the Jews), along with 'euthanasia' (for the disabled) and 'evacuation' (deportation to gas chambers).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which pastor and resistance fighter wrote the famous reflection on silence beginning 'First they came for the Communists... Then when they came for me, there was no one left who could stand up for me'?",
            options: ["Pastor Niemoeller", "Charlotte Beradt", "Erna Kranz", "Dietrich Bonhoeffer"],
            correct: 0,
            explanation: "Pastor Niemoeller wrote this reflection on the uncanny silence of ordinary Germans in the face of Nazi persecution of different groups.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Nazi killing operations against the Jews, in which about 6 million Jews were murdered, are collectively referred to as:",
            options: ["The Great Purge", "The Holocaust", "The Final War", "The Great Terror"],
            correct: 1,
            explanation: "The Nazi genocide of European Jews, in which about 6 million Jews were killed, is known as the Holocaust.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In his letters to Hitler in 1939 and 1940 appealing for peace, Mahatma Gandhi described non-violence as a force that, if organised, could match the most violent forces in the world, calling it:",
            options: ["'Do or die'", "'It is all do or die without killing or hurting'", "'An eye for an eye'", "'Ahimsa Paramo Dharma'"],
            correct: 1,
            explanation: "In his 1940 letter to Hitler, Gandhi wrote that non-violent technique involves no such thing as defeat and 'is all do or die without killing or hurting'.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "forest-society-and-colonialism-class9",
        name: "Forest Society and Colonialism (Class 9)",
        questions: [
          q({
            text: "Between 1700 and 1995, the period of industrialisation, how much of the world's forest area was cleared for industrial uses, cultivation, pastures and fuelwood?",
            options: ["1.4 million sq km (0.9%)", "13.9 million sq km (9.3%)", "50 million sq km (33%)", "100 million sq km (66%)"],
            correct: 1,
            explanation: "Between 1700 and 1995, 13.9 million sq km of forest, or 9.3 per cent of the world's total area, was cleared during the period of industrialisation.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "By the early nineteenth century, the depletion of which forests in England created a timber supply problem for the Royal Navy, driving the search for timber resources in India?",
            options: ["Pine forests", "Oak forests", "Teak forests", "Birch forests"],
            correct: 1,
            explanation: "The disappearance of oak forests in England created a timber crisis for the Royal Navy, prompting search parties to explore India's forest resources from the 1820s.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Each mile of railway track required between 1,760 and 2,000 wooden planks laid across the tracks to hold them in position. What were these planks called?",
            options: ["Girders", "Sleepers", "Trusses", "Ballasts"],
            correct: 1,
            explanation: "'Sleepers' are the wooden planks laid across railway tracks to hold them in position; each mile of track needed 1,760-2,000 of them.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Which German expert was invited by the British and made the first Inspector General of Forests in India, going on to set up the Indian Forest Service in 1864?",
            options: ["Dietrich Brandis", "Verrier Elwin", "E.P. Stebbing", "Francis Buchanan"],
            correct: 0,
            explanation: "Dietrich Brandis, a German expert, was made the first Inspector General of Forests in India and helped formulate the Indian Forest Act of 1865.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The system of managing forests where natural forests with diverse species were cut down and replaced with one type of tree planted in straight rows, is known as:",
            options: ["Shifting cultivation", "Scientific forestry", "Taungya cultivation", "Swidden agriculture"],
            correct: 1,
            explanation: "'Scientific forestry' involved cutting natural forests and planting a single tree species in straight rows, or plantations, to be cut and replanted on a planned cycle.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Indian Forest Act of 1878 divided forests into three categories. Villagers could not take anything, even for their own use, from which category, considered the best forests?",
            options: ["Village forests", "Protected forests", "Reserved forests", "Community forests"],
            correct: 2,
            explanation: "The 1878 Act divided forests into reserved, protected and village forests; villagers were barred from taking anything from 'reserved forests', the best forests.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In India, shifting or swidden agriculture goes by many local names. Which of the following is NOT one of them?",
            options: ["Jhum", "Podu", "Milpa", "Bewar"],
            correct: 2,
            explanation: "'Milpa' is the name for swidden agriculture in Central America; in India, local names include jhum, podu, bewar, dhya, penda, nevad, khandad and kumri.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Between 1875 and 1925, colonial authorities gave rewards for killing large animals seen as threats to cultivators. About how many tigers were killed for reward in this period?",
            options: ["8,000", "80,000", "800,000", "8,000,000"],
            correct: 1,
            explanation: "Over 80,000 tigers, 150,000 leopards and 200,000 wolves were killed for reward between 1875 and 1925.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The forest rebellion of 1910, led in part by Gunda Dhur, in which villagers rose against reservation of two-thirds of the forest and a ban on shifting cultivation, hunting and forest produce collection, took place in the kingdom of:",
            options: ["Bastar", "Santhal Parganas", "Chhotanagpur", "Java"],
            correct: 0,
            explanation: "The 1910 Bastar rebellion, initiated by the Dhurwas of the Kanger forest and associated with the figure of Gunda Dhur, was a major forest rebellion against colonial reservation policies.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "As a result of the Bastar rebellion of 1910, what major concession did the British ultimately make?",
            options: [
              "They abolished all forest reservations in India",
              "Work on reservation was temporarily suspended and the reserved area was reduced to roughly half",
              "They granted Bastar full independence",
              "They banned all commercial forestry across India",
            ],
            correct: 1,
            explanation: "Following the rebellion, the British temporarily suspended reservation work and reduced the area to be reserved to roughly half of that originally planned.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Java, the Dutch colonial power depended on a community of skilled forest cutters and shifting cultivators to harvest teak, whose 6,000 families were divided between two kingdoms in 1755. This community was called:",
            options: ["The Kalangs", "The Saminists", "The Agarias", "The Banjaras"],
            correct: 0,
            explanation: "The Kalangs of Java were skilled forest cutters whose expertise was so valued that their families were split between the two kingdoms when Mataram divided in 1755.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under the Dutch 'blandongdiensten' system in Java, villages were exempted from paying forest rents if they:",
            options: [
              "Converted to Christianity",
              "Provided free labour and buffaloes for cutting and transporting timber",
              "Paid a fixed cash tax instead",
              "Planted only rice",
            ],
            correct: 1,
            explanation: "Under the blandongdiensten system, villages were exempted from rents on forest land in exchange for providing free labour and buffaloes for timber work.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Around 1890, which figure in Randublatung village began questioning Dutch state ownership of the forest, arguing the state had not created wind, water, earth and wood and so could not own them?",
            options: ["Dietrich Brandis", "Surontiko Samin", "Verrier Elwin", "Gunda Dhur"],
            correct: 1,
            explanation: "Surontiko Samin of Randublatung began a widespread movement questioning state ownership of the forest, with followers ('Saminists') refusing taxes and labour demands.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which forest community in Central India petitioned the government after their shifting cultivation was stopped in 1892, saying 'We daily starve, having had no foodgrain in our possession... The only wealth we possess is our axe'?",
            options: ["Santhals", "Baigas", "Gonds", "Bhils"],
            correct: 1,
            explanation: "The Baigas, a forest community of Central India, petitioned the government after their shifting cultivation was banned in 1892, describing severe hardship.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "pastoralists-in-modern-world-class9",
        name: "Pastoralists in the Modern World (Class 9)",
        questions: [
          q({
            text: "The Gujjar Bakarwals of Jammu and Kashmir, who migrate in groups called 'kafilas' between the Siwalik range in winter and Kashmir valley in summer, are primarily herders of:",
            options: ["Camels", "Goats and sheep", "Cattle only", "Yaks"],
            correct: 1,
            explanation: "The Gujjar Bakarwals are great herders of goat and sheep, moving in kafilas between winter grazing in the Siwaliks and summer pastures in Kashmir.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Gaddi shepherds of Himachal Pradesh spent their summer months grazing flocks in which high-altitude region, after wintering in the Siwalik range?",
            options: ["Lahul and Spiti", "Ladakh", "Garhwal", "Kashmir valley"],
            correct: 0,
            explanation: "The Gaddi shepherds spent summer in Lahul and Spiti before descending to the Siwalik hills for winter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Gujjar cattle herders of Garhwal and Kumaon moved between the dry forested 'bhabar' in winter and the high-altitude meadows called:",
            options: ["Dhars", "Bugyals", "Kolkhoz", "Kandi"],
            correct: 1,
            explanation: "'Bugyals' are the vast high-altitude meadows where Garhwal/Kumaon pastoralists grazed their herds in summer, descending to the 'bhabar' in winter.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Dhangar shepherds of Maharashtra grazed their flocks on the semi-arid central plateau during the monsoon, then moved to which fertile, high-rainfall coastal tract by October after the bajra harvest?",
            options: ["Malabar", "Konkan", "Coromandel", "Kachchh"],
            correct: 1,
            explanation: "Dhangars moved from the dry central plateau to the fertile Konkan coast by October, where their flocks manured the fields after the kharif harvest.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the deserts of Rajasthan, the Raikas combined cultivation with pastoralism; one group among them, known as the Maru Raikas, specialised in herding which animal?",
            options: ["Sheep", "Goats", "Camels", "Cattle"],
            correct: 2,
            explanation: "The Maru (desert) Raikas were a group specialising in herding camels, while another group of Raikas reared sheep and goats.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which colonial-era legislation classified many communities of craftsmen, traders and pastoralists as inherently 'criminal by nature and birth', restricting them to notified village settlements?",
            options: ["Forest Act, 1865", "Criminal Tribes Act, 1871", "Waste Land Rules", "Vernacular Press Act"],
            correct: 1,
            explanation: "The Criminal Tribes Act of 1871 classified many nomadic and pastoral communities as 'Criminal Tribes', restricting their movement to notified settlements.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under British forest laws, forests classified as 'Protected' allowed pastoralists some customary grazing rights, while 'Reserved' forests producing valuable timber like deodar or sal:",
            options: [
              "Allowed unrestricted grazing",
              "Barred all pastoralist access",
              "Were open only during monsoon",
              "Were managed jointly with village councils",
            ],
            correct: 1,
            explanation: "'Reserved' forests, producing commercially valuable timber like deodar or sal, barred pastoralists from access entirely; 'Protected' forests allowed some restricted customary rights.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "From the mid-nineteenth century, uncultivated grazing lands taken over under legislation and given to select individuals for cultivation were governed by the:",
            options: ["Waste Land Rules", "Enclosure Acts", "Criminal Tribes Act", "Grazing Tax Rules"],
            correct: 0,
            explanation: "Waste Land Rules allowed the colonial state to take over 'uncultivated' grazing lands, seen as 'waste', and grant them to select individuals for cultivation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After the Partition of India in 1947, which community of camel and sheep herders could no longer move into Sindh to graze on the banks of the Indus, and instead began migrating to Haryana?",
            options: ["Gujjar Bakarwals", "Raikas", "Dhangars", "Gaddis"],
            correct: 1,
            explanation: "The Raikas could no longer cross into Sindh after Partition created new political boundaries, and began migrating to Haryana instead.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Maasai cattle herders of east Africa lost about what percentage of their pre-colonial lands after Maasailand was cut in half between British Kenya and German Tanganyika in 1885?",
            options: ["20 per cent", "40 per cent", "60 per cent", "90 per cent"],
            correct: 2,
            explanation: "The Maasai lost about 60 per cent of their pre-colonial lands, confined to an arid zone with uncertain rainfall in south Kenya and north Tanzania.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Large areas of former Maasai grazing land were turned into game reserves, including the Serengeti National Park, created over how much Maasai grazing land in Tanzania?",
            options: ["1,000 sq km", "14,760 sq km", "50,000 sq km", "100,000 sq km"],
            correct: 1,
            explanation: "The Serengeti National Park was created over 14,760 sq km of former Maasai grazing land.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In pre-colonial Maasai society, which two social categories structured authority, with elders forming the ruling group and the other group responsible for defending the community and organising cattle raids?",
            options: ["Chiefs and priests", "Elders and warriors", "Landlords and tenants", "Traders and herders"],
            correct: 1,
            explanation: "Maasai society was divided into elders (the ruling group who settled disputes) and warriors (younger men responsible for defence and cattle raids).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the severe droughts of 1933 and 1934, what happened to the cattle stock of the Maasai confined within their colonial-era reserve?",
            options: [
              "Cattle numbers doubled due to good breeding programmes",
              "Over half the cattle in the Maasai Reserve died",
              "The British provided sufficient fodder to prevent losses",
              "Cattle were relocated safely to new pastures",
            ],
            correct: 1,
            explanation: "Confined to a fixed reserve and unable to move to areas with available pasture, over half the cattle in the Maasai Reserve died during the 1933-34 droughts.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "peasants-and-farmers-class9",
        name: "Peasants and Farmers (Class 9)",
        questions: [
          q({
            text: "Between 1820 and 1913, the international economy for foodgrains and cotton expanded rapidly. Which region became a major source of wheat imports feeding growing urban populations in Europe?",
            options: ["The United States and Canada", "West Africa", "Southeast Asia", "The Caribbean islands"],
            correct: 0,
            explanation: "As European urban populations grew after 1820, food imports rose sharply, and the prairies of the United States and Canada became major sources of wheat exported to feed growing cities in Europe.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "In 1830, English labourers destroyed threshing machines in protest against loss of livelihood, sending threatening letters signed in the name of a mythic figure. This wave of unrest is known as:",
            options: ["The Chartist Movement", "The Captain Swing riots", "The Peterloo Massacre", "The Corn Law protests"],
            correct: 1,
            explanation: "The Captain Swing riots (1830-32) saw about 387 threshing machines destroyed by labourers protesting job losses to mechanisation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Before the enclosure movement, English peasants had access to common land where they pastured cattle, collected fuelwood and fished. What was this shared land called?",
            options: ["The commons", "The manor", "The demesne", "The steppe"],
            correct: 0,
            explanation: "'The commons' referred to land accessible to all villagers for grazing, fuelwood collection, fishing and hunting — essential for the survival of the poor.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Between 1750 and 1850, how much land was enclosed in England, legalised through around 4,000 Acts of Parliament?",
            options: ["1 million acres", "6 million acres", "20 million acres", "50 million acres"],
            correct: 1,
            explanation: "Between 1750 and 1850, 6 million acres of land was enclosed in England, legalised through about 4,000 Parliamentary Acts.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The late eighteenth-century enclosures in England were primarily driven by the need to expand production of which crop, unlike the sixteenth-century enclosures that had promoted sheep farming?",
            options: ["Cotton", "Grain", "Tea", "Tobacco"],
            correct: 1,
            explanation: "Unlike sixteenth-century sheep-farming enclosures, the late eighteenth-century enclosures were driven by rising demand for grain, fuelled by population growth and urbanisation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the mid-eighteenth century, English farmers discovered that growing which two crops as part of a rotation could restore nitrogen to depleted soil?",
            options: ["Wheat and barley", "Turnip and clover", "Rice and maize", "Cotton and indigo"],
            correct: 1,
            explanation: "Turnip and clover, grown from about the 1660s, were found to restore soil nitrogen and improve fertility, becoming part of regular crop rotation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After the American War of Independence, the US government's policy of driving American Indians progressively westward, first beyond the Mississippi and then further, was accompanied by:",
            options: [
              "Peaceful negotiated land purchases only",
              "Numerous wars, massacres and forced treaties",
              "Full integration of Indian tribes into settler society",
              "A complete halt to westward settlement",
            ],
            correct: 1,
            explanation: "The US government waged numerous wars against American Indians, forcing them through massacres and treaties to give up land and move progressively westward.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which inventor's 1831 mechanical reaper could cut in one day as much as five men with cradles or sixteen men with sickles, revolutionising wheat harvesting in the USA?",
            options: ["Eli Whitney", "Cyrus McCormick", "John Deere", "Henry Ford"],
            correct: 1,
            explanation: "Cyrus McCormick invented the mechanical reaper in 1831, dramatically increasing harvesting efficiency in American wheat farming.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the First World War, US President Wilson called on American farmers to expand wheat production with the slogan:",
            options: ["\"Plant more wheat, wheat will win the war\"", "\"Feed the world\"", "\"Grow for victory\"", "\"America first\""],
            correct: 0,
            explanation: "Wilson's call, 'Plant more wheat, wheat will win the war', responded to the loss of Russian wheat supplies and the need to feed Europe during the First World War.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The terrifying duststorms of the 1930s that turned the American Great Plains into a wasteland, caused by drought combined with the stripping of grass cover from over-ploughed land, created what came to be called the:",
            options: ["Bread Basket", "Dust Bowl", "Black Belt", "Great Plains Crisis"],
            correct: 1,
            explanation: "The 'Dust Bowl' resulted from persistent drought combined with reckless over-ploughing that stripped the land of grass cover holding the soil together.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The history of opium production in colonial India was closely linked to British trade with China, where opium was exchanged to finance the purchase of which commodity that had become a popular English drink?",
            options: ["Silk", "Tea", "Porcelain", "Spices"],
            correct: 1,
            explanation: "Opium exports to China financed the East India Company's purchase of tea, which had become an increasingly popular and important trade for England.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Who was sent by the Chinese Emperor to Canton in 1839 as Special Commissioner, arresting 1,600 opium traders and burning 20,000 crates of opium, ultimately triggering the Opium War?",
            options: ["Lin Ze-xu", "Sun Yat-sen", "Deng Xiaoping", "Chiang Kai-shek"],
            correct: 0,
            explanation: "Lin Ze-xu confiscated and destroyed opium stocks at Canton in 1839, and wrote a letter of protest to Queen Victoria before Britain declared the Opium War.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Indian cultivators in Bengal and Bihar were made to grow opium against their preference through a system in which village headmen (mahato) advanced money on behalf of government agents. What did this system tie the cultivator to?",
            options: [
              "Freedom to sell to any buyer",
              "A fixed obligation to grow opium on specified land and sell only to the government agent at a low fixed price",
              "A cooperative farming society",
              "Direct land ownership rights",
            ],
            correct: 1,
            explanation: "Once a cultivator accepted the loan/advance, they were bound to grow opium on specified land and hand over the produce to government agents at a low, fixed price.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "By 1773, the British government in Bengal had established what kind of control over opium trade?",
            options: ["Free and open competition", "A government monopoly", "A cooperative system", "No control at all"],
            correct: 1,
            explanation: "The British established a government monopoly over opium trade in Bengal by 1773, making it illegal for anyone else to trade in the product.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "history-and-sport-cricket-class9",
        name: "History and Sport: The Story of Cricket (Class 9)",
        questions: [
          q({
            text: "The first written 'Laws of Cricket', specifying stump height and ball weight among other rules, were drawn up in which year?",
            options: ["1660", "1744", "1877", "1900"],
            correct: 1,
            explanation: "The first written Laws of Cricket were drawn up in 1744, establishing standardised rules for the game.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which club, founded in 1787, became the guardian of cricket's regulations, publishing its first revision of the laws in 1788?",
            options: ["Yorkshire Cricket Club", "Marylebone Cricket Club (MCC)", "Lord's Cricket Club", "Hambledon Club"],
            correct: 1,
            explanation: "The Marylebone Cricket Club (MCC), founded in 1787, became the guardian of cricket's laws, publishing its first revision in 1788.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Cricket's rule that a Test match can last five days and still end in a draw, and its vagueness about ground size, both stem from the game's origins in which historical setting?",
            options: ["Industrial factory towns", "Rural English village life and commons", "Royal court tournaments", "American frontier settlements"],
            correct: 1,
            explanation: "Cricket's unusual length and lack of fixed ground dimensions reflect its pre-industrial origins on rural English village commons, unlike games codified after the Industrial Revolution.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Victorian England cricket, the rich who played for pleasure were called 'Gentlemen', while the poor who played for a living, entering through different gates, were called:",
            options: ["Amateurs", "Players", "Professionals-in-training", "Servants"],
            correct: 1,
            explanation: "Amateurs (the rich) were called 'Gentlemen', while professionals (the poor, who played for wages) were called 'Players' — a social distinction built into cricket's customs.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The first Indian cricket club, founded in Bombay in 1848 by a community closely connected to British trade, was the:",
            options: ["Bombay Gymkhana", "Oriental Cricket Club (Parsi)", "Hindu Gymkhana", "Calcutta Cricket Club"],
            correct: 1,
            explanation: "The Parsis founded the Oriental Cricket Club in Bombay in 1848, becoming the first Indian community to organise cricket.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The major first-class cricket tournament of colonial India, initially played between four teams organised on religious/racial lines (Europeans, Parsis, Hindus, Muslims), was called the:",
            options: ["Ranji Trophy", "The Quadrangular (later Pentangular)", "The Duleep Trophy", "The Imperial Cup"],
            correct: 1,
            explanation: "The Quadrangular (later Pentangular, with the addition of the 'Rest' team) was organised along communal/racial lines, unlike the regional Ranji Trophy.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Dalit cricketer, the greatest Indian slow bowler of his era who played for the Hindus in the Quadrangular, was never made captain due to caste discrimination, though his brother Vithal later captained the team?",
            options: ["C.K. Nayudu", "Palwankar Baloo", "Vijay Hazare", "Ranjitsinhji"],
            correct: 1,
            explanation: "Palwankar Baloo, despite being the Hindus' greatest bowler, was never made captain because upper-caste selectors discriminated against him for being a Dalit.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "India entered Test cricket in 1932, a decade and a half before independence, because Test cricket from its origins in 1877 was organised as a contest between:",
            options: ["Sovereign nations only", "Different parts of the British empire", "Commonwealth republics", "Olympic nations"],
            correct: 1,
            explanation: "Test cricket was organised as a contest between parts of the British empire rather than sovereign nations, allowing colonies like India and Australia to play Tests before independence.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Who was India's first Test captain, playing against England in 1932 despite being past his cricketing prime?",
            options: ["Palwankar Baloo", "C.K. Nayudu", "Vijay Hazare", "Vithal"],
            correct: 1,
            explanation: "C.K. Nayudu was India's first Test captain in 1932, remembered in popular imagination while contemporaries like the Palwankar brothers, who never played Tests, were largely forgotten.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Test-playing nations like India, Pakistan and the West Indies boycotted playing Test cricket with which country due to its policy of racial segregation, until pressure forced a cancelled tour in 1970?",
            options: ["Australia", "South Africa", "New Zealand", "Zimbabwe"],
            correct: 1,
            explanation: "South Africa's apartheid policy, barring non-whites from representing the country, led to a boycott by India, Pakistan and the West Indies, and a cancelled 1970 tour to England.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Australian television tycoon signed up 51 of the world's leading cricketers in 1977 to stage unofficial matches called World Series Cricket, introducing coloured clothing and cricket under lights?",
            options: ["Rupert Murdoch", "Kerry Packer", "Allen Stanford", "Lalit Modi"],
            correct: 1,
            explanation: "Kerry Packer's World Series Cricket (1977) introduced coloured dress, helmets, field restrictions and floodlit cricket, permanently changing the game's television-friendly format.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The ICC headquarters shifted from London to which city, symbolising the shift of cricket's centre of gravity towards South Asia?",
            options: ["Mumbai", "Dubai", "Singapore", "Colombo"],
            correct: 1,
            explanation: "The ICC headquarters moved from London to tax-free Dubai, symbolising the shift of cricket's economic and administrative centre towards South Asia.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which two bowling innovations, developed in response to sub-continental pitch conditions, are credited to Pakistan's pioneering role in modern cricket technique?",
            options: [
              "The bouncer and the yorker",
              "The doosra and reverse swing",
              "The googly and the flipper",
              "The slower ball and the knuckleball",
            ],
            correct: 1,
            explanation: "Pakistan pioneered the doosra (to counter aggressive batting) and reverse swing (to move the ball on dusty, unresponsive wickets), both later accepted globally.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "clothing-social-history-class9",
        name: "Clothing: A Social History (Class 9)",
        questions: [
          q({
            text: "In medieval France, laws that regulated what clothing, food and behaviour were permitted based on social rank, from about 1294 until the French Revolution, were known as:",
            options: ["Sumptuary laws", "Feudal codes", "Estate charters", "Napoleonic codes"],
            correct: 0,
            explanation: "Sumptuary laws regulated dress, food and behaviour by social rank in medieval France, restricting materials like ermine, fur, silk and velvet to royalty and nobility.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The French Revolution ended sumptuary law distinctions; Jacobin supporters signalled the end of aristocratic privilege by rejecting the aristocracy's characteristic:",
            options: ["Red caps", "Knee breeches", "Silk stockings", "Powdered wigs"],
            correct: 1,
            explanation: "Jacobins called themselves 'sans-culottes' ('without knee breeches') to distinguish themselves from the aristocracy, who wore fashionable knee breeches.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Victorian norms of femininity required women, from childhood, to wear tightly laced garments to restrict body growth and create a small waist. What was this garment called?",
            options: ["Chemise", "Corset", "Kimono", "Toga"],
            correct: 1,
            explanation: "Corsets were tightly laced garments women wore from a young age to maintain a small waist, considered essential to Victorian ideals of feminine attractiveness.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In America in the 1870s, the National Woman Suffrage Association and the American Woman Suffrage Association both campaigned for dress reform, arguing for what change?",
            options: [
              "Longer, more voluminous skirts",
              "Simplified dress, shorter skirts, and abandonment of corsets",
              "A return to sumptuary laws",
              "Mandatory uniforms for all women",
            ],
            correct: 1,
            explanation: "Both suffrage associations campaigned to simplify dress, shorten skirts and abandon corsets, arguing that comfortable clothing would let women work and become independent.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which American dress reformer launched loose tunics worn over ankle-length trousers, which came to be popularly known as 'bloomers'?",
            options: ["Lucy Stone", "Amelia Bloomer", "Mrs Stanton", "Susan B. Anthony"],
            correct: 1,
            explanation: "Amelia Bloomer was the first dress reformer to popularise loose tunics over ankle-length trousers, which came to be called 'bloomers'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which world event caused the most dramatic and lasting change to women's clothing in the West, with over 700,000 British women employed in ammunition factories by 1917 requiring practical working uniforms?",
            options: ["The French Revolution", "The First World War", "The Great Depression", "The Second World War"],
            correct: 1,
            explanation: "The First World War brought radical change as women entered the workforce in large numbers, wearing practical blouses, trousers and overalls suited to factory work.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In May 1822, women of which caste were attacked by Nairs in Travancore for wearing a cloth to cover their upper bodies, sparking a decades-long conflict over dress codes?",
            options: ["Ezhavas", "Shanars (later Nadars)", "Brahmans", "Vaishyas"],
            correct: 1,
            explanation: "Shanar women (later known as Nadars) were attacked in Travancore in 1822 for covering their upper bodies, a right traditionally denied to their 'subordinate caste' status.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The 1859 riots in Travancore over Shanar women's dress led the government to eventually issue a proclamation permitting Shanar women to cover their upper bodies, but with what condition attached?",
            options: [
              "Only on religious holidays",
              "In any manner whatever, but not like the women of high caste",
              "Only if they paid an additional tax",
              "Only inside their own homes",
            ],
            correct: 1,
            explanation: "The government's proclamation permitted Shanar women to cover their upper bodies 'in any manner whatever, but not like the women of high caste' — a partial concession that preserved caste distinction.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In colonial India, the turban and the hat symbolised different meanings across cultures. What conflict arose from this difference?",
            options: [
              "The British were offended when Indians did not remove their turbans in front of officials, while Indians saw the turban as a mark of respectability that could not be casually removed",
              "The British insisted all Indians wear turbans",
              "Indians refused to acknowledge hats as headwear at all",
              "There was no conflict, both were treated identically",
            ],
            correct: 0,
            explanation: "The turban in India was a sign of respectability not to be removed at will, while in Western tradition a hat was removed as a sign of respect — a cultural mismatch that caused friction.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the famous 1862 Surat courtroom case, Manockjee Cowasjee Entee refused to remove his shoes, saying he would even take off his turban but not his shoes, because for him the shoes carried:",
            options: [
              "No respect or disrespect at all, unlike the turban which conveyed the greatest respect",
              "Religious significance forbidding their removal",
              "A caste marking that could not be revealed",
              "A symbol of British loyalty",
            ],
            correct: 0,
            explanation: "Manockjee argued that shoes held no meaning of respect or disrespect for Parsis, while the turban (pugree) represented the highest form of social respect.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Rabindranath Tagore suggested that India's national dress should combine elements of Hindu and Muslim dress, considering which garment the most suitable for men?",
            options: ["Dhoti", "Chapkan (a long buttoned coat)", "Sherwani", "Achkan with turban"],
            correct: 1,
            explanation: "Tagore considered the chapkan, a long buttoned coat, the most suitable national dress for men, combining Hindu and Muslim sartorial traditions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Jnanadanandini Devi, wife of the first Indian member of the ICS, popularised a style of wearing the sari pinned to the shoulder with a blouse and shoes, adapted from Parsi fashion. This style came to be known as the:",
            options: ["Nivi sari", "Brahmika sari", "Bengali sari", "Coorgi sari"],
            correct: 1,
            explanation: "The 'Brahmika sari', adapted from Parsi styles by Jnanadanandini Devi, was quickly adopted by Brahmo Samaji women and spread beyond Bengal.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Swadeshi movement, developing in reaction to the 1905 partition of Bengal, made the wearing of which homespun cloth a patriotic duty?",
            options: ["Muslin", "Khadi", "Silk", "Chintz"],
            correct: 1,
            explanation: "The Swadeshi movement made khadi (coarse homespun cloth) a symbol of patriotic duty, urging people to boycott British mill-made cloth.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Mahatma Gandhi adopted the short dhoti, the dress he wore until his death, in which year, a year after launching the Non-Cooperation Movement?",
            options: ["1915", "1921", "1930", "1942"],
            correct: 1,
            explanation: "Gandhi adopted the short dhoti in 1921, initially intending it as a temporary experiment, but wore it for the rest of his life as a symbol of identifying with the poorest Indians.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Unlike Mahatma Gandhi, which nationalist leader, born into an 'untouchable' caste discriminated against for centuries, never gave up the Western-style suit, seeing it as a statement of self-respect?",
            options: ["Motilal Nehru", "B.R. Ambedkar", "Sarojini Naidu", "C. Rajagopalachari"],
            correct: 1,
            explanation: "B.R. Ambedkar never gave up Western-style dress; many Dalits adopted three-piece suits as a political statement of self-respect against caste-based deprivation.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "rise-of-nationalism-in-europe-class10",
        name: "The Rise of Nationalism in Europe (Class 10)",
        questions: [
          q({
            text: "In 1848, French artist Frédéric Sorrieu prepared a series of four prints visualising his dream of a world made up of 'democratic and social Republics'. In the first print, which figure do the peoples of Europe and America offer homage to as they march past?",
            options: ["The statue of Liberty", "A portrait of Napoleon", "The Bourbon king", "The Pope"],
            correct: 0,
            explanation: "Sorrieu's utopian print shows peoples of the world marching past and offering homage to the statue of Liberty, bearing the torch of Enlightenment and the Charter of the Rights of Man.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Napoleonic Code of 1804 did away with all privileges based on birth, established equality before the law, and secured the right to property. In territories under French control, Napoleon also:",
            options: [
              "Restored the feudal system and serfdom",
              "Abolished the feudal system, simplified administrative divisions, and freed peasants from serfdom",
              "Reintroduced absolute monarchy everywhere",
              "Banned all trade between regions",
            ],
            correct: 1,
            explanation: "Napoleon abolished feudalism and serfdom, simplified administrative divisions, and removed guild restrictions in the Dutch Republic, Switzerland, Italy and Germany.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1815, representatives of Britain, Russia, Prussia and Austria met in Vienna, hosted by Austrian Chancellor Duke Metternich, to draw up a settlement undoing most of Napoleon's changes. This was known as:",
            options: ["The Congress of Vienna / Treaty of Vienna", "The Treaty of Versailles", "The Congress of Berlin", "The Treaty of Frankfurt"],
            correct: 0,
            explanation: "The Congress of Vienna (1815) restored the Bourbon dynasty in France and created a new conservative order in Europe, undoing many Napoleonic changes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Italian revolutionary Giuseppe Mazzini founded two underground societies, Young Italy in Marseilles and Young Europe in Berne. Metternich described him as:",
            options: [
              "'A harmless dreamer'",
              "'The most dangerous enemy of our social order'",
              "'A loyal servant of the crown'",
              "'The father of German unification'",
            ],
            correct: 1,
            explanation: "Metternich, architect of the conservative post-1815 order, described Mazzini's opposition to monarchy and vision of democratic republics as making him the most dangerous enemy of the social order.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1834, a customs union was formed at the initiative of Prussia and joined by most German states, abolishing tariff barriers and reducing the number of currencies from over thirty to two. This union was called the:",
            options: ["Zollverein", "Bundesrat", "Reichstag", "Konfederation"],
            correct: 0,
            explanation: "The Zollverein (customs union), formed in 1834, stimulated economic nationalism by abolishing tariff barriers between German states.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The English poet Lord Byron organised funds and went to fight in which nationalist struggle, dying of fever in 1824, before the Treaty of Constantinople (1832) recognised its independence?",
            options: ["The Italian unification", "The Greek war of independence", "The Polish rebellion of 1831", "The Belgian revolt"],
            correct: 1,
            explanation: "Lord Byron supported the Greek war of independence against the Ottoman Empire and died of fever in 1824; Greece's independence was recognised in 1832.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "German philosopher Johann Gottfried Herder claimed that true German culture was to be discovered among the common people ('das volk'), and that the true spirit of the nation was expressed through folk songs, poetry and dances — a concept he called:",
            options: ["Volksgeist", "Zeitgeist", "Weltanschauung", "Lebensraum"],
            correct: 0,
            explanation: "Herder's concept of 'volksgeist' (spirit of the nation) held that collecting and recording folk culture was essential to nation-building.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Grimm Brothers of Germany spent years travelling from village to village collecting old folktales, publishing their first collection in 1812. Besides folktales, they also published a landmark work of what kind?",
            options: ["A 33-volume dictionary of the German language", "A collection of German patriotic songs", "A history of the Holy Roman Empire", "A map of German-speaking territories"],
            correct: 0,
            explanation: "The Grimm brothers also published a 33-volume dictionary of the German language, alongside their folktale collections, both seen as part of building German national identity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1845, weavers in Silesia led a revolt against contractors who supplied raw material and drastically reduced payments for finished textiles. What happened when the army was called in?",
            options: [
              "The contractor was arrested",
              "Eleven weavers were shot",
              "The revolt succeeded without violence",
              "The weavers were given higher wages immediately",
            ],
            correct: 1,
            explanation: "When the contractor requisitioned the army after fleeing, eleven weavers were shot in the resulting confrontation.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the German regions, middle-class professionals and businessmen gathered in which city in 1848 to vote for an all-German National Assembly, convening in the Church of St Paul?",
            options: ["Berlin", "Frankfurt", "Vienna", "Munich"],
            correct: 1,
            explanation: "The Frankfurt Parliament convened in the Church of St Paul in 1848, drafting a constitution for a German nation headed by a monarchy subject to parliament.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "When the Frankfurt Parliament offered the crown of a united Germany, subject to a parliamentary constitution, to Friedrich Wilhelm IV, King of Prussia, what did he do?",
            options: [
              "He accepted immediately",
              "He rejected it and joined other monarchs to oppose the elected assembly",
              "He abdicated in favour of his son",
              "He convened a second parliament to reconsider"
            ],
            correct: 1,
            explanation: "Friedrich Wilhelm IV rejected the crown offered on parliamentary terms and joined other monarchs in opposing the elected Frankfurt assembly, which was eventually forced to disband.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Prussian chief minister engineered the unification of Germany through three wars over seven years (with Austria, Denmark and France), culminating in the proclamation of the German Empire in 1871?",
            options: ["Otto von Bismarck", "Klemens von Metternich", "Camillo de Cavour", "Friedrich Wilhelm IV"],
            correct: 0,
            explanation: "Otto von Bismarck, chief minister of Prussia, was the architect of German unification, achieved through the Prussian army and bureaucracy across three wars.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The proclamation of the German Empire, with William I of Prussia as Kaiser, took place on 18 January 1871 in which location, symbolising Prussian military dominance over France?",
            options: ["The Reichstag, Berlin", "The Hall of Mirrors, Palace of Versailles", "The Vatican, Rome", "St Paul's Cathedral, London"],
            correct: 1,
            explanation: "The German Empire was proclaimed in the Hall of Mirrors at the Palace of Versailles, a deliberately symbolic location following Prussia's defeat of France.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the middle of the nineteenth century, Italy was divided into seven states, of which only Sardinia-Piedmont was ruled by an Italian princely house. Which Chief Minister of Sardinia-Piedmont led the movement to unify Italy through diplomacy and war?",
            options: ["Giuseppe Mazzini", "Camillo Benso de Cavour", "Giuseppe Garibaldi", "Victor Emmanuel II"],
            correct: 1,
            explanation: "Chief Minister Cavour, neither a revolutionary nor a democrat, engineered a diplomatic alliance with France that helped Sardinia-Piedmont defeat Austrian forces in 1859.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1860, Giuseppe Garibaldi led an army of volunteers, popularly known for their distinctive dress, into South Italy and the Kingdom of the Two Sicilies. What were his volunteers called?",
            options: ["Red Shirts", "Black Shirts", "Brown Shirts", "Green Guards"],
            correct: 0,
            explanation: "Garibaldi's volunteers, who grew to about 30,000 during the 'Expedition of the Thousand', were popularly known as the Red Shirts.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Unlike most of continental Europe, the formation of the British nation-state was not the result of a sudden revolution. The Act of Union of 1707 between England and Scotland created the:",
            options: [
              "Kingdom of Great Britain",
              "United Kingdom of Great Britain",
              "Commonwealth of Nations",
              "British Empire"
            ],
            correct: 1,
            explanation: "The Act of Union (1707) between England and Scotland formed the 'United Kingdom of Great Britain', with the English-dominated parliament shaping a new British identity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The female allegorical figure used to represent the French Republic and nation, drawing on the imagery of Liberty (red cap, tricolour, cockade), was named:",
            options: ["Britannia", "Marianne", "Germania", "Athena"],
            correct: 1,
            explanation: "Marianne, a popular Christian name, personified the French Republic and nation, appearing on coins, stamps, and public statues.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Germania, the female allegory of the German nation, wears a crown of oak leaves in visual representations. What does the German oak symbolise?",
            options: ["Peace", "Heroism", "Wealth", "Wisdom"],
            correct: 1,
            explanation: "The German oak, forming Germania's crown, stands for heroism in the allegorical imagery of German nationalism.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "By the last quarter of the nineteenth century, the most serious source of nationalist tension in Europe was a region of geographical and ethnic variation, largely under Ottoman control, whose Slav inhabitants sought independence. This region was known as:",
            options: ["The Balkans", "The Rhineland", "The Sudetenland", "Alsace-Lorraine"],
            correct: 0,
            explanation: "The Balkans, home to Romania, Bulgaria, Serbia and other Slav nationalities under Ottoman decline, became an intensely explosive nationalist tinderbox and a scene of great-power rivalry, ultimately helping trigger the First World War.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "nationalism-in-india-class10",
        name: "Nationalism in India (Class 10)",
        questions: [
          q({
            text: "According to the census of 1921, how many people are estimated to have perished in India due to the famines and influenza epidemic of 1918-21, following economic hardship caused by the First World War?",
            options: ["1-2 million", "5-6 million", "12-13 million", "25-30 million"],
            correct: 2,
            explanation: "The census of 1921 estimated that 12 to 13 million people died as a result of famines and the influenza epidemic in the years following the First World War.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahatma Gandhi's idea of 'satyagraha' emphasised the power of truth and non-violence, suggesting that a satyagrahi could win a battle without physical force by appealing to the conscience of the oppressor. Where did Gandhi first successfully develop and use this method of mass agitation?",
            options: ["Champaran, Bihar", "South Africa", "Ahmedabad", "Kheda, Gujarat"],
            correct: 1,
            explanation: "Gandhi developed satyagraha in South Africa while fighting the racist regime, before returning to India in January 1915 and applying it in Champaran, Kheda and Ahmedabad.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1917, Mahatma Gandhi organised a satyagraha in the Kheda district of Gujarat to support peasants who, affected by crop failure and a plague epidemic, were demanding:",
            options: [
              "Higher wages for agricultural labour",
              "Relaxation of revenue collection",
              "Reservation in the Legislative Council",
              "Abolition of the salt tax",
            ],
            correct: 1,
            explanation: "Kheda peasants, unable to pay revenue due to crop failure and plague, demanded that revenue collection be relaxed.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Rowlatt Act (1919), passed despite the united opposition of Indian members in the Imperial Legislative Council, gave the government the power to:",
            options: [
              "Grant Indians dominion status immediately",
              "Detain political prisoners without trial for two years",
              "Establish provincial autonomy",
              "Create separate electorates for all religious communities"
            ],
            correct: 1,
            explanation: "The Rowlatt Act gave the government enormous powers to repress political activities, including detention of political prisoners without trial for two years.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "On 13 April 1919, General Dyer entered the enclosed ground of Jallianwala Bagh in Amritsar, blocked the exit points, and opened fire on a crowd that had gathered partly to protest and partly to attend which annual event?",
            options: ["Diwali fair", "Baisakhi fair", "Eid celebrations", "Republic Day parade"],
            correct: 1,
            explanation: "Many in the crowd at Jallianwala Bagh had come to attend the annual Baisakhi fair, unaware of the martial law that had been imposed.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "To bring Hindus and Muslims together in a unified national movement, Mahatma Gandhi took up an issue concerning the Ottoman Emperor's temporal powers as the spiritual head of the Islamic world (the Khalifa). This was known as the:",
            options: ["Rowlatt issue", "Khilafat issue", "Simon issue", "Poona issue"],
            correct: 1,
            explanation: "The Khilafat issue, championed by leaders like Muhammad Ali and Shaukat Ali, was taken up by Gandhi as a way to unite Hindus and Muslims in the Non-Cooperation Movement.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In his 1909 book Hind Swaraj, Mahatma Gandhi declared that British rule in India had survived only because of Indian cooperation, and that if Indians refused to cooperate, British rule would collapse and swaraj would come within:",
            options: ["A month", "A year", "Five years", "A decade"],
            correct: 1,
            explanation: "Gandhi declared in Hind Swaraj that non-cooperation could bring down British rule and achieve swaraj within a year.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "At which Congress session in December 1920 was a compromise worked out and the Non-Cooperation programme formally adopted?",
            options: ["Calcutta session", "Nagpur session", "Lahore session", "Lucknow session"],
            correct: 1,
            explanation: "The Non-Cooperation programme was adopted at the Congress session held at Nagpur in December 1920, after intense internal debate.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Awadh, peasants were led by Baba Ramchandra, a sanyasi who had earlier worked as an indentured labourer in which country?",
            options: ["Mauritius", "Fiji", "Trinidad", "British Guiana"],
            correct: 1,
            explanation: "Baba Ramchandra had earlier been to Fiji as an indentured labourer before leading the Awadh peasant movement against talukdars and landlords.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In the Gudem Hills of Andhra Pradesh, a militant guerrilla movement in the early 1920s was led by a figure who claimed special powers, talked of Mahatma Gandhi and Non-Cooperation, but insisted swaraj could be won only by force. He was:",
            options: ["Baba Ramchandra", "Alluri Sitarama Raju", "Vallabhbhai Patel", "Ghaffar Khan"],
            correct: 1,
            explanation: "Alluri Sitarama Raju led the Gudem Hills guerrilla rebellion, blending Gandhian rhetoric with an insistence on armed force; he was captured and executed in 1924.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under the Inland Emigration Act of 1859, plantation workers in Assam were not permitted to leave the tea gardens without permission. During the Non-Cooperation Movement, what did many of these workers do?",
            options: [
              "They organised a strike demanding higher wages within the plantations",
              "They defied authorities, left the plantations, and tried to head home believing Gandhi Raj was coming",
              "They petitioned the British government for citizenship",
              "They joined the Simon Commission's inquiry"
            ],
            correct: 1,
            explanation: "Plantation workers defied the Inland Emigration Act, left the tea gardens en masse believing 'Gandhi Raj' was coming, though most were caught by police before reaching home.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahatma Gandhi withdrew the Non-Cooperation Movement in February 1922 following which violent incident?",
            options: ["The Jallianwala Bagh massacre", "The Chauri Chaura incident", "The Chittagong armoury raid", "The Kakori conspiracy"],
            correct: 1,
            explanation: "The Chauri Chaura incident, where a peaceful demonstration turned violent and a police station was burnt, led Gandhi to call off the Non-Cooperation Movement.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "C.R. Das and Motilal Nehru formed which party within the Congress to argue for a return to council politics after the Non-Cooperation Movement was withdrawn?",
            options: ["The Swaraj Party", "The Justice Party", "The Home Rule League", "The Liberal Federation"],
            correct: 0,
            explanation: "C.R. Das and Motilal Nehru formed the Swaraj Party to participate in council elections and oppose British policies from within the legislature.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Simon Commission, set up by the British to review India's constitutional system, was greeted with the slogan 'Go back Simon' when it arrived in 1928. What was the key criticism of this commission?",
            options: [
              "It recommended immediate independence",
              "It had no Indian members",
              "It was too sympathetic to Congress demands",
              "It was formed too late"
            ],
            correct: 1,
            explanation: "The Simon Commission's members were all British with no Indian representation, provoking widespread nationalist protest.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "At the Lahore Congress of December 1929, under the presidency of Jawaharlal Nehru, the Congress formalised the demand of 'Purna Swaraj'. What date was declared to be celebrated as Independence Day, when people took a pledge to struggle for complete independence?",
            options: ["15 August 1929", "26 January 1930", "6 April 1930", "2 October 1930"],
            correct: 1,
            explanation: "26 January 1930 was declared Independence Day, with people taking a pledge for Purna Swaraj, though this early celebration attracted limited attention.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Mahatma Gandhi's Salt March covered over 240 miles from Sabarmati to which coastal town in Gujarat, where he ceremonially broke the salt law by making salt from seawater on 6 April 1930?",
            options: ["Porbandar", "Dandi", "Surat", "Bharuch"],
            correct: 1,
            explanation: "Gandhi's 24-day march from Sabarmati Ashram to the coastal town of Dandi culminated in the ceremonial breaking of the salt law, marking the start of the Civil Disobedience Movement.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The pact signed on 5 March 1931 between Mahatma Gandhi and Viceroy Irwin, under which Gandhi agreed to participate in the Round Table Conference and the government agreed to release political prisoners, is known as the:",
            options: ["The Poona Pact", "The Gandhi-Irwin Pact", "The Lucknow Pact", "The Delhi Pact"],
            correct: 1,
            explanation: "The Gandhi-Irwin Pact (5 March 1931) led to a temporary suspension of the Civil Disobedience Movement and Gandhi's participation in the Second Round Table Conference.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which rich peasant communities of Gujarat and Uttar Pradesh, hit hard by falling prices during the Depression, became enthusiastic supporters of the Civil Disobedience Movement, fighting against high revenue demands?",
            options: ["Patidars and Jats", "Rajputs and Marathas", "Zamindars and Talukdars", "Kunbis and Reddys"],
            correct: 0,
            explanation: "The Patidars of Gujarat and the Jats of Uttar Pradesh, rich peasant communities producing commercial crops, were active supporters of the Civil Disobedience Movement.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Dr B.R. Ambedkar organised the Depressed Classes Association in 1930 and clashed with Mahatma Gandhi at the second Round Table Conference over the demand for separate electorates for dalits. The resulting compromise, in which Gandhi undertook a fast unto death, was called the:",
            options: ["The Lucknow Pact", "The Poona Pact", "The Gandhi-Irwin Pact", "The Nehru Report"],
            correct: 1,
            explanation: "The Poona Pact (September 1932) gave the Depressed Classes reserved seats in legislative councils, but to be voted in by the general electorate rather than separate electorates.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Who wrote the influential 1930 statement, as president of the Muslim League, reiterating the importance of separate electorates as a safeguard for Muslim minority political interests — a statement said to have provided intellectual justification for the later Pakistan demand?",
            options: ["Muhammad Ali Jinnah", "Sir Muhammad Iqbal", "Shaukat Ali", "Liaquat Ali Khan"],
            correct: 1,
            explanation: "Sir Muhammad Iqbal's 1930 presidential address to the Muslim League argued for separate electorates as essential to protect Muslim cultural and political development.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The image of Bharat Mata, first created by Bankim Chandra Chattopadhyay through his hymn 'Vande Mataram' (included in his novel Anandamath), was famously painted in 1905 by which artist as a calm, ascetic, divine figure?",
            options: ["Raja Ravi Varma", "Abanindranath Tagore", "Nandalal Bose", "Jamini Roy"],
            correct: 1,
            explanation: "Abanindranath Tagore's 1905 painting of Bharat Mata, moved by the Swadeshi movement, portrayed her as an ascetic, calm, divine and spiritual figure dispensing learning, food and clothing.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Madras, which scholar published a massive four-volume collection titled 'The Folklore of Southern India', believing folklore to be 'the most trustworthy manifestation of people's real thoughts and characteristics'?",
            options: ["Rabindranath Tagore", "Natesa Sastri", "Bankim Chandra Chattopadhyay", "Tarinicharan Chattopadhyay"],
            correct: 1,
            explanation: "Natesa Sastri's four-volume Tamil folklore collection was part of the wider late-nineteenth-century movement to revive Indian folklore as a source of national identity.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "During the Swadeshi movement in Bengal, a tricolour flag (red, green and yellow) was designed with eight lotuses representing eight provinces and a crescent moon representing Hindus and Muslims. By 1921, Gandhi designed the Swaraj flag with which central symbol?",
            options: ["A lotus", "A spinning wheel (charkha)", "A rising sun", "An eagle"],
            correct: 1,
            explanation: "Gandhi's 1921 Swaraj flag, a red, green and white tricolour, had a spinning wheel at its centre, representing the Gandhian ideal of self-help.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Hindustan Socialist Republican Army (HSRA), founded at Ferozeshah Kotla in Delhi in 1928, included Bhagat Singh among its leaders. Which slogan did Bhagat Singh famously raise, declaring 'revolution is the inalienable right of mankind'?",
            options: ["'Do or Die'", "'Inquilab Zindabad'", "'Swaraj is my birthright'", "'Quit India'"],
            correct: 1,
            explanation: "Bhagat Singh raised the slogan 'Inquilab Zindabad!' ('Long Live the Revolution'), stating he wished to bring about a revolution in society, not merely glorify 'the cult of the bomb and pistol'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Quit India Movement was formally launched after the Congress Working Committee's historic resolution passed in Wardha on 14 July 1942, followed by the All India Congress Committee's endorsement in Bombay on 8 August 1942, when Gandhi delivered his famous speech:",
            options: ["'Tryst with Destiny'", "'Do or Die'", "'Freedom at Midnight'", "'Quit India, Come What May'"],
            correct: 1,
            explanation: "Gandhi's famous 'Do or Die' speech was delivered on 8 August 1942 when the AICC endorsed the Quit India resolution, calling for a non-violent mass struggle demanding immediate British withdrawal.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "making-of-a-global-world-class10",
        name: "The Making of a Global World (Class 10)",
        questions: [
          q({
            text: "The world's first permanent photographic image, a crude heliographic view produced using a camera obscura, is credited to which inventor?",
            options: ["Nicephore Niepce", "Louis Daguerre", "William Fox Talbot", "George Eastman"],
            correct: 0,
            explanation: "The French inventor Nicephore Niepce produced the earliest surviving permanent photographic image around 1826-27, using a technique he called heliography.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The British Labour Party, formed to represent the interests of the growing industrial working class, was founded in the year:",
            options: ["1900", "1832", "1917", "1867"],
            correct: 0,
            explanation: "The British Labour Party was founded in 1900 as the Labour Representation Committee, later becoming a major political party representing organised labour.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "In the Soviet Union, the term 'Kulaks' referred to:",
            options: ["Rich, land-owning peasants", "Landless agricultural labourers", "Industrial factory workers", "Communist Party officials"],
            correct: 0,
            explanation: "'Kulaks' was the term used in the Soviet Union for relatively wealthy, land-owning peasants, who were targeted during Stalin's collectivisation campaigns.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Which European country was the last to formally abolish serfdom, doing so in 1861?",
            options: ["Russia", "France", "Germany", "Austria-Hungary"],
            correct: 0,
            explanation: "Russia was among the last major European powers to abolish serfdom, when Tsar Alexander II issued the Emancipation Reform in 1861.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Tsar Alexander II's Emancipation Reform of 1861, which freed Russia's serfs from bondage to landowners, was passed by which ruler?",
            options: ["Alexander II", "Nicholas I", "Nicholas II", "Peter the Great"],
            correct: 0,
            explanation: "Tsar Alexander II issued the Emancipation Reform of 1861, formally freeing serfs from personal bondage to their landlords, though land redistribution remained limited.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "As early as 3000 BCE, an active coastal trade linked the Indus valley civilisations with which region?",
            options: ["East Africa", "Present-day West Asia", "Southeast Asia", "The Mediterranean"],
            correct: 1,
            explanation: "An active coastal trade linked the Indus valley civilisations with present-day West Asia as early as 3000 BCE.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The 'silk routes' are named for the importance of West-bound Chinese silk cargoes, though they also carried Chinese pottery and textiles and spices from India and Southeast Asia. What flowed from Europe to Asia in return along these routes?",
            options: ["Cotton and wool", "Precious metals — gold and silver", "Tea and coffee", "Iron and steel"],
            correct: 1,
            explanation: "Precious metals, particularly gold and silver, flowed from Europe to Asia along the silk routes in exchange for silk, pottery, textiles and spices.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Common foods such as potatoes, soya, groundnuts, maize, tomatoes and chillies were introduced to Europe and Asia only after which event of the late fifteenth century?",
            options: [
              "The fall of Constantinople",
              "Christopher Columbus's accidental discovery of the Americas",
              "The Protestant Reformation",
              "The invention of the printing press"
            ],
            correct: 1,
            explanation: "These now-common foods originated with the original inhabitants of the Americas and only reached Europe and Asia after Columbus's voyages.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the Great Irish Potato Famine (1845-1849), around how many people died of starvation in Ireland after disease destroyed the potato crop?",
            options: ["100,000", "1,000,000", "5,000,000", "10,000,000"],
            correct: 1,
            explanation: "Around 1,000,000 people died of starvation during the Irish Potato Famine, and double that number emigrated in search of work.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the chapter, the most powerful weapon of the Spanish conquerors of America was not a conventional military weapon but:",
            options: ["Gunpowder", "Germs such as smallpox, to which the natives had no immunity", "Horses", "Steel armour"],
            correct: 1,
            explanation: "Smallpox and other European diseases, against which America's original inhabitants had no immunity, killed and decimated whole communities, paving the way for conquest even ahead of the arrival of Europeans.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In nineteenth-century Britain, the laws that restricted the import of corn (food grains) to protect landed groups' interests were known as the:",
            options: ["Enclosure Acts", "Corn Laws", "Navigation Acts", "Factory Acts"],
            correct: 1,
            explanation: "The Corn Laws restricted grain imports; their abolition, forced by industrialists and urban dwellers unhappy with high food prices, allowed cheaper food imports into Britain.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "After the Corn Laws were scrapped and food could be imported more cheaply, what happened to British agriculture and its workforce?",
            options: [
              "British agriculture became more competitive and thrived",
              "Vast areas of land were left uncultivated, and thousands of workers migrated to cities or overseas",
              "The government subsidised domestic farmers to compete with imports",
              "Food prices in Britain rose further"
            ],
            correct: 1,
            explanation: "Unable to compete with cheap imports, British agriculture left large tracts of land uncultivated, and displaced agricultural workers moved to cities or emigrated overseas.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Roughly how many people are estimated to have emigrated from Europe to America and Australia in the nineteenth century?",
            options: ["5 million", "20 million", "50 million", "150 million"],
            correct: 2,
            explanation: "Nearly 50 million people emigrated from Europe to America and Australia in the nineteenth century, as part of a global migration estimated at about 150 million people worldwide.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In west Punjab, the British Indian government built a network of irrigation canals to transform semi-desert wastes into fertile agricultural lands for wheat and cotton export. These newly irrigated areas were called:",
            options: ["Canal Colonies", "Wasteland Settlements", "Ryotwari Tracts", "Zamindari Estates"],
            correct: 0,
            explanation: "The 'Canal Colonies' in west Punjab were settled by peasants from other parts of Punjab to grow wheat and cotton for export using new irrigation networks.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The development of refrigerated ships in the late nineteenth century transformed the meat trade by allowing animals to be slaughtered at the point of origin (America, Australia, New Zealand) and shipped as frozen meat. What was the main effect of this technology?",
            options: [
              "Meat prices in Europe rose sharply",
              "It reduced shipping costs and lowered meat prices, allowing Europe's poor a more varied diet",
              "It eliminated the need for live animal transport entirely without changing prices",
              "It caused a shortage of meat in Europe"
            ],
            correct: 1,
            explanation: "Refrigerated ships reduced shipping costs, lowered meat prices, and let the European poor add meat, butter and eggs to a diet that had been mostly bread and potatoes.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1885, the major European powers met in Berlin to complete the carving up of which continent between them, drawing straight-line borders with little regard for local realities?",
            options: ["Asia", "Africa", "South America", "The Middle East"],
            correct: 1,
            explanation: "The Berlin Conference of 1885 saw European powers divide Africa between themselves, with straight-ruled borders demarcating their claimed territories.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In the 1890s, a devastating cattle disease carried by infected cattle imported to feed Italian soldiers invading Eritrea spread across Africa 'like forest fire', killing 90 per cent of cattle along the way and destroying African livelihoods. This disease was:",
            options: ["Foot-and-mouth disease", "Rinderpest (cattle plague)", "Anthrax", "Bovine tuberculosis"],
            correct: 1,
            explanation: "Rinderpest devastated African cattle stocks, enabling European colonisers to monopolise remaining cattle resources and force Africans into the wage labour market.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Under the system of indentured labour migration from India, workers were hired under contracts promising return travel to India after working how many years on their employer's plantation?",
            options: ["Two years", "Five years", "Ten years", "Fifteen years"],
            correct: 1,
            explanation: "Indentured labourers were contracted to work for five years on plantations, after which they were promised return passage to India.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In Trinidad, the annual Muharram procession was transformed by Indian indentured workers into a riotous carnival joined by workers of all races and religions, called:",
            options: ["Hosay", "Chutney festival", "Diwali Mela", "Holi Carnival"],
            correct: 0,
            explanation: "'Hosay' (from Imam Hussain) was the Trinidadian carnival transformation of the Muharram procession, reflecting cultural fusion among indentured communities.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The system of indentured labour migration, described as a 'new system of slavery', was abolished in which year following opposition from India's nationalist leaders?",
            options: ["1900", "1911", "1921", "1931"],
            correct: 2,
            explanation: "Indentured labour migration was abolished in 1921 after decades of nationalist opposition describing it as abusive and cruel.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which groups of Indian bankers and traders financed export agriculture in Central and Southeast Asia using their own funds or funds borrowed from European banks?",
            options: [
              "Only Marwari businessmen",
              "Shikaripuri shroffs and Nattukottai Chettiars",
              "Only Parsi industrialists",
              "Bengal zamindars"
            ],
            correct: 1,
            explanation: "Shikaripuri shroffs and Nattukottai Chettiars were among the Indian banking groups that financed export agriculture across Central and Southeast Asia.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Between 1812 and 1871, as manufactured cotton textile exports from India declined, the share of raw cotton exports rose from 5 per cent to what percentage?",
            options: ["15 per cent", "35 per cent", "55 per cent", "75 per cent"],
            correct: 1,
            explanation: "Raw cotton exports from India rose from 5 per cent to 35 per cent between 1812 and 1871, reflecting India's shift from manufacturer to raw material supplier under colonial rule.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Britain used its 'trade surplus' with India — where the value of British exports to India exceeded imports from India — to do what within the world economy?",
            options: [
              "Fund the American Revolution",
              "Balance its trade deficits with other countries through a multilateral settlement system",
              "Repay debts owed to France",
              "Establish colonies in South America"
            ],
            correct: 1,
            explanation: "Britain used its trade surplus with India to balance its deficits with other countries, a mechanism known as the multilateral settlement system, and to pay 'home charges' including pensions and remittances.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In 1921, one in every five British workers was out of work, reflecting the difficult post-war economic recovery. What was one major reason for this crisis?",
            options: [
              "Britain refused to trade with its colonies",
              "Wartime industries contracted after the war boom ended, while industries had developed in India and Japan during the war",
              "The Bretton Woods system collapsed",
              "The Great Depression had already begun"
            ],
            correct: 1,
            explanation: "Post-war production contraction, alongside Britain's difficulty recapturing its pre-war dominance in India and competing with Japan, contributed to massive unemployment in Britain.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Henry Ford adapted the assembly line of a Chicago slaughterhouse to his car plant in Detroit, allowing cars to come off the line at three-minute intervals. What did Ford do in January 1914 to address high worker turnover from the stress of assembly-line work?",
            options: [
              "He reduced working hours to four hours a day",
              "He doubled the daily wage to $5 while banning trade unions",
              "He introduced worker-owned shares in the company",
              "He hired only skilled craftsmen instead of assembly workers"
            ],
            correct: 1,
            explanation: "Ford doubled the daily wage to $5 to reduce worker turnover, while simultaneously banning trade unions from operating in his plants — he later called this his 'best cost-cutting decision'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Great Depression, beginning around 1929, was worsened by which factor related to US lending?",
            options: [
              "The US refused to lend money to any country",
              "US overseas lenders panicked at the first sign of trouble and sharply withdrew loans, hitting countries dependent on US capital",
              "The US doubled its foreign aid budget",
              "The gold standard was abolished, causing hyperinflation"
            ],
            correct: 1,
            explanation: "US overseas loans fell from over $1 billion in early 1928 to a quarter of that a year later, triggering banking failures and currency collapses in countries dependent on US lending.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the Great Depression, wheat prices in India fell by about how much between 1928 and 1934, severely hurting peasants even as the colonial government refused to reduce revenue demands?",
            options: ["10 per cent", "25 per cent", "50 per cent", "90 per cent"],
            correct: 2,
            explanation: "Wheat prices in India fell by 50 per cent between 1928 and 1934, deepening peasant indebtedness as the colonial government maintained its revenue demands.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Bretton Woods Conference of July 1944 established two institutions to preserve economic stability and full employment in the post-war world. What were they?",
            options: [
              "The United Nations and NATO",
              "The International Monetary Fund (IMF) and the World Bank",
              "The World Trade Organization and G-77",
              "The League of Nations and the Red Cross"
            ],
            correct: 1,
            explanation: "The Bretton Woods Conference established the IMF (to deal with external surpluses and deficits) and the World Bank (to finance post-war reconstruction), together known as the Bretton Woods twins.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The Bretton Woods system was based on fixed exchange rates, with national currencies pegged to the dollar, which was itself anchored to gold at a fixed price. What was this fixed gold price?",
            options: ["$10 per ounce", "$35 per ounce", "$100 per ounce", "$500 per ounce"],
            correct: 1,
            explanation: "The dollar was anchored to gold at a fixed price of $35 per ounce under the Bretton Woods system.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Developing countries, dissatisfied that they had not benefited from the fast growth Western economies experienced in the 1950s-60s, organised themselves into a group to demand a New International Economic Order (NIEO). This group was known as:",
            options: ["The G-7", "The G-77", "The Non-Aligned Movement", "OPEC"],
            correct: 1,
            explanation: "The Group of 77 (G-77) demanded real control over natural resources, more development assistance, fairer raw material prices, and better market access for their manufactured goods.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "age-of-industrialisation-class10",
        name: "The Age of Industrialisation (Class 10)",
        questions: [
          q({
            text: "In 1769, Richard Arkwright patented a mechanised device in England for spinning thread using water power. This invention was known as the:",
            options: ["Water frame", "Spinning jenny", "Power loom", "Cotton gin"],
            correct: 0,
            explanation: "Richard Arkwright patented the water frame in 1769, a mechanised spinning device driven by water power that helped establish the factory system in the cotton industry.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Which invention greatly sped up the process of separating cotton fibre from its seeds, enabling mass production of raw cotton for industry?",
            options: ["The cotton gin", "The spinning jenny", "The power loom", "The steam engine"],
            correct: 0,
            explanation: "Eli Whitney's cotton gin (1793) mechanised the separation of cotton fibre from seeds, dramatically increasing the supply of raw cotton available to textile mills.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Which historian argued that the British Industrial Revolution should be understood as a gradual socio-economic transformation rather than a sudden, sweeping 'revolution'?",
            options: ["E.P. Thompson", "Eric Hobsbawm", "Karl Marx", "Adam Smith"],
            correct: 0,
            explanation: "The historian E.P. Thompson, among others, questioned the term 'Industrial Revolution', emphasising instead the slow, uneven socio-economic changes that unfolded over decades in Britain.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Historians refer to the phase of large-scale industrial production for an international market that existed before factories, based on merchants supplying money to peasants and artisans in the countryside, as:",
            options: ["Cottage industrialisation", "Proto-industrialisation", "Guild production", "Domestic manufacturing"],
            correct: 1,
            explanation: "'Proto-industrialisation' describes the pre-factory phase where merchants moved to the countryside, financing production by peasants and artisans for international trade.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Why did merchants in seventeenth- and eighteenth-century Europe move production to the countryside rather than expanding within towns?",
            options: [
              "Rural labour was more skilled",
              "Urban crafts and trade guilds held monopoly rights and restricted new entrants",
              "Towns lacked access to raw materials",
              "Rural areas had better transport links"
            ],
            correct: 1,
            explanation: "Powerful urban guilds controlled production, trained craftspeople and restricted new entrants, making it difficult for merchants to expand business within towns.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which entrepreneur created the cotton mill, bringing together under one roof and management all the processes that had earlier been spread across the countryside in individual households?",
            options: ["James Watt", "Richard Arkwright", "James Hargreaves", "Henry Ford"],
            correct: 1,
            explanation: "Richard Arkwright created the cotton mill, allowing costly new machines to be set up under one roof with careful supervision of production and labour.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "By 1873, Britain was exporting iron and steel worth about £77 million, double the value of its cotton exports. This reflected the shift in Britain's leading industrial sector after the 1840s from cotton to:",
            options: ["Coal", "Iron and steel", "Textiles", "Shipbuilding"],
            correct: 1,
            explanation: "After cotton led the first phase of industrialisation up to the 1840s, iron and steel became the leading sector as railway expansion boosted demand.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "According to the chapter, even at the end of the nineteenth century, what percentage of the total workforce in Britain was employed in technologically advanced industrial sectors?",
            options: ["Less than 20 per cent", "About 40 per cent", "About 60 per cent", "Over 80 per cent"],
            correct: 0,
            explanation: "Less than 20 per cent of the total workforce was employed in technologically advanced industrial sectors even at the end of the nineteenth century, showing traditional industries remained dominant.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "James Watt improved and patented a new steam engine in 1781, manufactured by his industrialist friend Mathew Boulton. How many steam engines existed in all of England at the beginning of the nineteenth century?",
            options: ["No more than 50", "No more than 100", "No more than 321", "Over 1,000"],
            correct: 2,
            explanation: "There were no more than 321 steam engines in all of England at the start of the nineteenth century, showing how slowly even powerful new technology was adopted.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In Victorian Britain, industrialists preferred hand labour over machines mainly because:",
            options: [
              "Machines were banned by law",
              "There was no shortage of human labour, so wages were low and there was little incentive to invest in costly machinery",
              "Hand labour was faster than machine labour",
              "The government subsidised only hand-labour industries"
            ],
            correct: 1,
            explanation: "With abundant labour and low wages, British industrialists had little incentive to invest in capital-intensive machines that displaced human workers.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In mid-nineteenth-century Britain, 500 varieties of hammers and 45 kinds of axes were produced, reflecting a market demand that machines could not easily meet. What kind of demand was this?",
            options: [
              "Demand for cheap, uniform, mass-produced goods",
              "Demand for goods with intricate designs and specific shapes, requiring human skill",
              "Demand for only exported goods",
              "Demand for goods with no variation at all"
            ],
            correct: 1,
            explanation: "The market often demanded goods with intricate designs and specific shapes that required human skill rather than mechanical uniformity.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "When the Spinning Jenny was introduced in the woollen industry, who began attacking the new machines, fearing loss of livelihood from hand spinning?",
            options: ["Male weavers", "Women who survived on hand spinning", "Factory owners", "Government inspectors"],
            correct: 1,
            explanation: "Women who depended on hand spinning for survival attacked the Spinning Jenny, fearing it would destroy their livelihood by reducing demand for manual labour.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "After the East India Company established political power in Bengal and Carnatic in the 1760s-70s, it appointed a paid servant to supervise weavers, collect supplies, and examine cloth quality. This official was called the:",
            options: ["Gomastha", "Sepoy", "Zamindar", "Diwan"],
            correct: 0,
            explanation: "The 'gomastha' was a Company official appointed to supervise weavers directly, eliminating the role of traditional traders and brokers.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In 1811-12, piece-goods (Indian textiles) accounted for 33 per cent of India's exports; by 1850-51 this had fallen to what percentage, reflecting the collapse of Indian textile exports?",
            options: ["25 per cent", "15 per cent", "3 per cent", "0.5 per cent"],
            correct: 2,
            explanation: "Indian piece-goods exports collapsed from 33 per cent in 1811-12 to just 3 per cent by 1850-51, as Manchester goods dominated global and Indian markets.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "By 1850, cotton piece-goods (imports) constituted over what percentage of the value of Indian imports, and by the 1870s over 50 per cent?",
            options: ["10 per cent", "31 per cent", "60 per cent", "90 per cent"],
            correct: 1,
            explanation: "British cotton piece-goods made up over 31 per cent of Indian imports by 1850, rising to over 50 per cent by the 1870s.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The first cotton mill in Bombay came up in which year, going into production two years later?",
            options: ["1834", "1854", "1874", "1894"],
            correct: 1,
            explanation: "The first cotton mill in Bombay came up in 1854 and began production in 1856.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Dwarkanath Tagore made his fortune in the China trade before turning to industrial investment, setting up six joint-stock companies in the 1830s and 1840s. In Bombay, which Parsi entrepreneurs built huge industrial empires with wealth accumulated partly from China trade?",
            options: ["Jamsetjee Jeejeebhoy and Dinshaw Petit", "Jamsetjee Nusserwanjee Tata and Dinshaw Petit", "G.D. Birla and Seth Hukumchand", "Purshottamdas Thakurdas and Homi Bhabha"],
            correct: 1,
            explanation: "Dinshaw Petit and Jamsetjee Nusserwanjee Tata, Parsi entrepreneurs, built industrial empires with wealth partly accumulated from China trade and cotton shipments to England.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which businessman set up the first Indian jute mill in Calcutta in 1917, also having traded with China?",
            options: ["Dwarkanath Tagore", "Seth Hukumchand", "G.D. Birla", "Jamsetjee Tata"],
            correct: 1,
            explanation: "Seth Hukumchand, a Marwari businessman with China trade connections, set up the first Indian jute mill in Calcutta in 1917.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In most industrial regions of India, factory owners employed an intermediary to recruit new workers, often an old and trusted worker who helped people from his village settle in the city and get jobs, but who also demanded money and gifts for this favour. This figure was called the:",
            options: ["Gomastha", "Jobber", "Sardar", "Mahajan"],
            correct: 1,
            explanation: "The 'jobber' recruited workers (often from his own village), helped them settle, and in turn gained authority and power over their lives, sometimes demanding payment for favours.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "J.N. Tata set up the first iron and steel works in India at Jamshedpur in which year?",
            options: ["1900", "1912", "1925", "1935"],
            correct: 1,
            explanation: "J.N. Tata established India's first iron and steel works at Jamshedpur in 1912, though such capital goods industries developed slowly under colonial rule.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Early Indian cotton mills, avoiding direct competition with Manchester goods in the Indian market, mostly produced which type of product?",
            options: ["Fine imported-quality yarn", "Coarse cotton yarn (thread)", "Finished silk cloth", "Woollen blankets"],
            correct: 1,
            explanation: "Early Indian spinning mills produced coarse cotton yarn, avoiding competition with superior imported yarn, and this yarn was used by handloom weavers or exported to China.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "During the First World War, Indian mills gained a vast home market as Manchester imports declined, and Indian factories were called upon to supply war needs such as jute bags, cloth for uniforms, tents and leather boots. What happened to Manchester's position after the war?",
            options: [
              "It fully recaptured its pre-war dominance in India",
              "It could never recapture its old position in the Indian market as local industrialists consolidated their position",
              "It shifted entirely to producing luxury goods",
              "It merged with Indian textile companies"
            ],
            correct: 1,
            explanation: "After the war, unable to compete with the US, Germany and Japan, Manchester never recaptured its pre-war dominance in India as local industrialists consolidated their position.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The technological innovation that increased productivity per worker in the handloom sector, with 35 per cent of Indian handlooms fitted with it by 1941 (70-80 per cent in regions like Travancore and Bengal), was the:",
            options: ["Spinning Jenny", "Fly shuttle", "Power loom", "Water frame"],
            correct: 1,
            explanation: "The fly shuttle, a mechanical device that increased weaving productivity, was adopted by a growing share of Indian handloom weavers by 1941.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Handloom weavers who produced finer varieties of cloth (such as Banarasi or Baluchari saris) were better positioned to survive mill competition than those producing coarse cloth, mainly because:",
            options: [
              "Fine cloth was cheaper to produce",
              "Demand from the well-to-do for finer varieties remained stable even during famines, unlike coarse cloth demand from the poor",
              "Mills could easily copy fine cloth designs",
              "The government banned mills from producing fine cloth"
            ],
            correct: 1,
            explanation: "The demand for finer varieties bought by the rich remained relatively stable even during famines, while demand for coarse cloth (bought by the poor) fluctuated violently with agricultural conditions.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "print-culture-modern-world-class10",
        name: "Print Culture and the Modern World (Class 10)",
        questions: [
          q({
            text: "The earliest print technology, a system of hand printing developed in China from AD 594 onwards, involved rubbing paper against the inked surface of:",
            options: ["Metal plates", "Woodblocks", "Stone tablets", "Clay tablets"],
            correct: 1,
            explanation: "Chinese hand-printing from AD 594 involved rubbing paper against inked woodblocks, producing the traditional folded 'accordion book'.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The oldest Japanese printed book, dating to AD 868, containing six sheets of text and woodcut illustrations, is the:",
            options: ["Tripitaka Koreana", "Diamond Sutra", "Jikji", "Gita Govinda"],
            correct: 1,
            explanation: "The Diamond Sutra (AD 868), introduced via Buddhist missionaries from China, is the oldest known printed Japanese book.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Korean printed work, dating to the late fourteenth century, is among the world's oldest existing books printed with movable metal type and was inscribed on the UNESCO Memory of the World Register in 2001?",
            options: ["The Diamond Sutra", "Jikji", "Tripitaka Koreana", "Akhlaq-i-Nasiri"],
            correct: 1,
            explanation: "The Jikji of Korea, printed in the late fourteenth century, is among the world's oldest books printed with movable metal type.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In 1295, which explorer returned to Italy after years in China, bringing back knowledge of woodblock printing technology which then spread across Europe?",
            options: ["Christopher Columbus", "Marco Polo", "Vasco da Gama", "Ferdinand Magellan"],
            correct: 1,
            explanation: "Marco Polo brought knowledge of Chinese woodblock printing technology back to Italy in 1295, from where it spread across Europe.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Johann Gutenberg, who drew on his knowledge of olive/wine presses and goldsmithing, developed the first-known printing press in the 1430s at:",
            options: ["Mainz", "Strasbourg", "Berlin", "Rome"],
            correct: 1,
            explanation: "Gutenberg developed the first-known printing press at Strasbourg, Germany, in the 1430s, adapting the olive press model and casting metal types for letters.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "By 1448, Gutenberg had perfected his printing system, and the first book he printed was:",
            options: ["The Quran", "The Bible", "The Ninety-Five Theses", "Don Quixote"],
            correct: 1,
            explanation: "Gutenberg's first printed book, completed by 1448, was the Bible; about 180 copies were produced over three years.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In 1517, which religious reformer wrote the Ninety-Five Theses criticising practices of the Roman Catholic Church, sparking the Protestant Reformation through the wide circulation enabled by print?",
            options: ["John Calvin", "Martin Luther", "Erasmus", "Henry VIII"],
            correct: 1,
            explanation: "Martin Luther's Ninety-Five Theses, printed and circulated widely, triggered the Protestant Reformation; Luther called printing 'the ultimate gift of God'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "In the sixteenth century, an Italian miller named Menocchio read available books and reinterpreted the Bible's message in a way that enraged the Roman Catholic Church, leading to his:",
            options: ["Excommunication only", "Being hauled up twice and ultimately executed by the Inquisition", "Being appointed as a Church scholar", "Banishment to a monastery"],
            correct: 1,
            explanation: "Menocchio's heretical reinterpretations, formed through his own reading, led the Roman Church's Inquisition to try him twice and ultimately execute him.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Troubled by print's effects on popular readings and questioning of faith, the Roman Catholic Church began maintaining an Index of Prohibited Books from:",
            options: ["1450", "1517", "1558", "1650"],
            correct: 2,
            explanation: "The Roman Church began maintaining its Index of Prohibited Books from 1558 to control the spread of heretical ideas through print.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "By the mid-eighteenth century, French novelist Louis-Sebastien Mercier declared that the printing press was the most powerful engine of progress, proclaiming: 'Tremble, therefore, tyrants of the world! Tremble before...'",
            options: ["'the virtual writer!'", "'the guillotine!'", "'the Republic!'", "'the reader!'"],
            correct: 0,
            explanation: "Mercier's proclamation 'Tremble... before the virtual writer!' reflected the widespread eighteenth-century belief that print could liberate society from despotism.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which of the following is NOT one of the three types of arguments historians make connecting print culture to the French Revolution?",
            options: [
              "Print popularised Enlightenment ideas critical of tradition, superstition and despotism",
              "Print created a new culture of dialogue and debate that re-evaluated norms and institutions",
              "Literature mocking royalty and criticising their morality circulated and raised questions about the social order",
              "Print eliminated all forms of monarchist and Church propaganda from circulation"
            ],
            correct: 3,
            explanation: "The chapter notes people were exposed to both revolutionary ideas and monarchical/Church propaganda; print did not eliminate opposing views, but it opened up the possibility of thinking differently.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In England, cheap pocket-sized books carried by travelling pedlars called 'chapmen' and sold for a penny, affordable even to the poor, were known as:",
            options: ["Almanacs", "Penny chapbooks", "Bibliotheque Bleue", "Broadsheets"],
            correct: 1,
            explanation: "Penny chapbooks, sold by chapmen for a penny, made reading material affordable to the poor in England.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "By the mid-nineteenth century, Richard M. Hoe of New York perfected the power-driven cylindrical press, particularly useful for printing newspapers, capable of printing how many sheets per hour?",
            options: ["800", "2,000", "8,000", "80,000"],
            correct: 2,
            explanation: "Richard Hoe's power-driven cylindrical press could print 8,000 sheets per hour, revolutionising newspaper production.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "In India, the printing press first arrived with Portuguese missionaries in the mid-sixteenth century at which location?",
            options: ["Bombay", "Goa", "Calcutta", "Madras"],
            correct: 1,
            explanation: "The printing press first came to Goa with Portuguese missionaries in the mid-sixteenth century, with Jesuit priests printing Konkani tracts.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "From 1780, who began editing the Bengal Gazette, a weekly magazine describing itself as 'a commercial paper open to all, but influenced by none', which published gossip about Company officials and provoked Governor-General Warren Hastings?",
            options: ["Rammohun Roy", "James Augustus Hickey", "Gangadhar Bhattacharya", "William Bolts"],
            correct: 1,
            explanation: "James Augustus Hickey's Bengal Gazette (1780) was private English enterprise that angered Warren Hastings by publishing critical gossip about Company officials.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Raja Rammohun Roy published the Sambad Kaumudi from 1821 to advance his reformist arguments; the Hindu orthodoxy responded by commissioning a rival publication called the:",
            options: ["Samachar Chandrika", "Jam-i-Jahan Nama", "Bombay Samachar", "Shamsul Akhbar"],
            correct: 0,
            explanation: "The Hindu orthodoxy commissioned the Samachar Chandrika to counter Rammohun Roy's reformist Sambad Kaumudi.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Founded in 1867, which seminary published thousands of fatwas telling Muslim readers how to conduct their everyday lives and explaining Islamic doctrines, using cheap lithographic presses?",
            options: ["Aligarh Muslim University", "The Deoband Seminary", "Nadwatul Ulama", "Jamia Millia Islamia"],
            correct: 1,
            explanation: "The Deoband Seminary, founded in 1867, extensively used print to publish fatwas guiding Muslim religious and everyday conduct.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Rashsundari Debi, a young married woman in an orthodox household in East Bengal, secretly learnt to read and write in her kitchen and later wrote her autobiography, published in 1876 and titled:",
            options: ["Stripurushtulna", "Amar Jiban", "Gulamgiri", "Sultana's Dream"],
            correct: 1,
            explanation: "Rashsundari Debi's 'Amar Jiban' (1876) was the first full-length autobiography published in the Bengali language.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Kanpur millworker wrote and published 'Chhote Aur Bade Ka Sawal' in 1938, showing the links between caste and class exploitation?",
            options: ["Sudarshan Chakr", "Kashibaba", "Jyotiba Phule", "B.R. Ambedkar"],
            correct: 1,
            explanation: "Kashibaba, a Kanpur millworker, wrote 'Chhote Aur Bade Ka Sawal' (1938) linking caste and class exploitation.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "The Vernacular Press Act, passed in 1878 and modelled on the Irish Press Laws, gave the colonial government extensive rights to:",
            options: [
              "Fund vernacular newspapers generously",
              "Censor reports and editorials in the vernacular press, seizing presses and confiscating machinery for seditious content",
              "Translate all vernacular newspapers into English",
              "Ban only English-language newspapers"
            ],
            correct: 1,
            explanation: "The Vernacular Press Act (1878) allowed the government to track, warn, and ultimately seize vernacular newspapers and their printing machinery for content judged seditious.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Bal Gangadhar Tilak wrote sympathetically in his newspaper Kesari about Punjab revolutionaries deported in 1907, leading to his imprisonment in which year?",
            options: ["1905", "1908", "1919", "1930"],
            correct: 1,
            explanation: "Tilak's sympathetic writing about deported Punjab revolutionaries in Kesari led to his imprisonment in 1908, sparking widespread protests.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
    ],
  },
  {
    slug: "economics",
    name: "Economics",
    topics: [
      {
        slug: "basic-concepts",
        name: "Basic Concepts",
        questions: [
          q({
            text: "Which curve is commonly used to represent the degree of income inequality within a population?",
            options: ["Lorenz Curve", "Phillips Curve", "Laffer Curve", "Indifference Curve"],
            correct: 0,
            explanation: "The Lorenz Curve plots the cumulative share of income against the cumulative share of the population, and its deviation from the line of perfect equality measures income inequality (as used in calculating the Gini coefficient).",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Sen Index, developed by economist Amartya Sen, is primarily associated with the measurement of:",
            options: ["Poverty", "Inflation", "Foreign trade", "Industrial output"],
            correct: 0,
            explanation: "The Sen Index, developed by Amartya Sen, is a composite measure of poverty that combines the headcount ratio, poverty gap and income inequality among the poor.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following correctly expresses the concept of Purchasing Power Parity (PPP) in a simplified form, where D is the domestic price, F is the foreign price, and e is the exchange rate?",
            options: ["D × e = F", "D + e = F", "D / F = e squared", "D − F = e"],
            correct: 0,
            explanation: "Purchasing Power Parity holds that, after converting using the exchange rate, the domestic price level should equal the foreign price level, expressed simply as D × e = F.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Chronic disguised unemployment, where more workers are engaged than actually needed without reducing output, is most typically found in:",
            options: ["Rural areas, especially in agriculture", "Urban organised industry", "The IT and services sector", "Export-oriented manufacturing"],
            correct: 0,
            explanation: "Disguised unemployment is a chronic feature of Indian agriculture, where family members work on small landholdings even though removing some of them would not reduce total farm output.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Cyclical unemployment, unlike structural or seasonal unemployment, is primarily caused by:",
            options: ["A fall in aggregate demand during an economic recession", "A permanent mismatch of skills", "Seasonal changes in agricultural labour demand", "Technological automation alone"],
            correct: 0,
            explanation: "Cyclical unemployment arises from fluctuations in the business cycle — when aggregate demand falls during a recession, firms reduce production and lay off workers, and employment recovers as the economy expands again.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Which of the following is generally classified as a 'near-money' asset — readily convertible to cash but not cash itself?",
            options: ["Treasury bills", "Debentures", "Equity shares", "Real estate"],
            correct: 0,
            explanation: "Treasury bills are short-term government securities considered highly liquid 'near-money' assets, easily convertible into cash; debentures are longer-term debt instruments and less liquid.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Agriculture and allied activities, which employ the largest share of India's workforce, constitute which sector of the economy?",
            options: ["Primary sector", "Secondary sector", "Tertiary sector", "Quaternary sector"],
            correct: 0,
            explanation: "Agriculture, forestry, fishing and mining fall under the primary sector, which involves the direct extraction and use of natural resources and remains the main occupation for a large share of India's workforce.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following best defines 'inflation'?",
            options: [
              "A fall in the general price level",
              "A sustained rise in the general price level",
              "An increase in the value of currency",
              "A decrease in unemployment",
            ],
            correct: 1,
            explanation: "Inflation refers to a sustained, general rise in the price level of goods and services over time.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "GDP at market price differs from GDP at factor cost by which of the following?",
            options: [
              "Net indirect taxes",
              "Depreciation",
              "Net factor income from abroad",
              "Net exports",
            ],
            correct: 0,
            explanation:
              "GDP at Market Price = GDP at Factor Cost + Indirect Taxes − Subsidies (net indirect taxes).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Who regulates monetary policy in India?",
            options: ["SEBI", "NITI Aayog", "Reserve Bank of India", "Ministry of Finance"],
            correct: 2,
            explanation: "The Reserve Bank of India (RBI) formulates and implements India's monetary policy.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "indian-economy",
        name: "Indian Economy",
        questions: [
          q({
            text: "Non-Banking Financial Companies (NBFCs) in India come under which category of the financial sector?",
            options: [
              "Both the organised and unorganised financial sectors",
              "Only the organised financial sector",
              "Only the unorganised financial sector",
              "Neither organised nor unorganised",
            ],
            correct: 0,
            explanation: "NBFCs span a range of entities, including large regulated finance companies (organised sector) as well as smaller, less-regulated lenders that function closer to the unorganised sector, so they are considered to fall under both categories.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following is NOT typically classified as a development bank in India?",
            options: ["Indian Overseas Bank", "NABARD", "SIDBI", "EXIM Bank"],
            correct: 0,
            explanation: "Indian Overseas Bank is a commercial (public sector) bank, whereas NABARD, SIDBI and the EXIM Bank are specialised development finance institutions set up to support specific sectors like agriculture, small industry and exports.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Regarding the Market Stabilisation Scheme (MSS), which statements are correct? I. It is an instrument for monetary management used by the RBI. II. It was introduced in 2010. III. It involves issuing short-dated government securities to absorb excess liquidity.",
            options: [
              "Statements I and III are correct",
              "Only statement II is correct",
              "All three statements are correct",
              "None of the statements is correct",
            ],
            correct: 0,
            explanation: "The Market Stabilisation Scheme is a monetary management tool under which the RBI issues short-dated government securities to absorb (sterilise) excess liquidity in the economy; it was actually introduced in 2004, not 2010, making statement II incorrect.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "A Treasury Bill issued by the Government of India is typically available in a minimum denomination, and multiples, of:",
            options: ["₹25,000", "₹1,000", "₹1,00,000", "₹500"],
            correct: 0,
            explanation: "Treasury bills issued by the Government of India are available in a minimum denomination of ₹25,000 and in multiples thereof.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Deen Dayal Upadhyaya Grameen Kaushalya Yojana (DDU-GKY) is a government scheme aimed at:",
            options: ["Vocational skill training and placement for rural youth", "Providing pensions to elderly farmers", "Rural road construction", "Crop insurance for farmers"],
            correct: 0,
            explanation: "DDU-GKY is a placement-linked skill development scheme under the Ministry of Rural Development, aimed at training rural youth to secure employment in various sectors.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The National Service Scheme (NSS), aimed at developing student volunteers' personality through community service, was launched in which year?",
            options: ["1969-70", "1975-76", "1985-86", "1950-51"],
            correct: 0,
            explanation: "The National Service Scheme was launched in 1969-70, on the birth centenary of Mahatma Gandhi, to engage college and university students in community service.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA), guaranteeing 100 days of wage employment to rural households, was passed by Parliament in:",
            options: ["2005", "1991", "2014", "1999"],
            correct: 0,
            explanation: "The National Rural Employment Guarantee Act (later renamed MGNREGA) was passed in 2005, guaranteeing at least 100 days of wage employment per year to rural households.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Swarnajayanti Gram Swarozgar Yojana (SGSY), a self-employment scheme for the rural poor later restructured into the National Rural Livelihoods Mission, was launched in:",
            options: ["1999", "1995", "2005", "2011"],
            correct: 0,
            explanation: "The Swarnajayanti Gram Swarozgar Yojana was launched in 1999 as a holistic self-employment programme for the rural poor, organising them into self-help groups.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "A 'buffer stock' of foodgrains, maintained by agencies like the Food Corporation of India, refers to:",
            options: [
              "The minimum stock of foodgrains maintained by the government to ensure food security",
              "Grain stored by private traders for speculative profit",
              "Foodgrain exported to earn foreign exchange",
              "Grain stock held only during a famine",
            ],
            correct: 0,
            explanation: "A buffer stock is the minimum quantity of foodgrains the government maintains (through procurement at MSP) to distribute during shortages and stabilise prices, ensuring food security.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Green Revolution in India is most associated with which crop initially?",
            options: ["Rice", "Wheat", "Cotton", "Sugarcane"],
            correct: 1,
            explanation: "The Green Revolution, starting in the mid-1960s, initially focused on high-yield wheat varieties.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Five-Year Plan is known as the 'Gadgil Yojna'?",
            options: ["Second", "Third", "Fourth", "Fifth"],
            correct: 2,
            explanation: "The Fourth Five-Year Plan (1969-74) is known as the Gadgil Yojna, named after D.R. Gadgil.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2017,
          }),
          q({
            text: "Which sector contributes the largest share to India's GDP currently?",
            options: ["Agriculture", "Industry", "Services", "Mining"],
            correct: 2,
            explanation: "The services sector contributes the largest share (over 50%) to India's GDP.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
    ],
  },
  {
    slug: "political-science",
    name: "Political Science",
    topics: [
      {
        slug: "indian-constitution",
        name: "Indian Constitution",
        questions: [
          q({
            text: "To become a judge of the Supreme Court of India, a person must be a citizen of India and must additionally satisfy which of the following qualifications?",
            options: [
              "Have been a judge of a High Court for at least 5 years, OR an advocate of a High Court for at least 10 years",
              "Be at least 50 years of age",
              "Have served as a Union minister",
              "Hold a law degree from a foreign university",
            ],
            correct: 0,
            explanation: "Under Article 124, a Supreme Court judge must be a citizen of India and must have been a High Court judge for at least 5 years, or a High Court advocate for at least 10 years, or a distinguished jurist; there is no minimum age requirement of 50 years.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Constitution of India, when it came into force in 1950, formally replaced which earlier legal document that had governed British India?",
            options: ["The Government of India Act, 1935", "The Indian Independence Act, 1947", "The Regulating Act, 1773", "The Charter Act, 1833"],
            correct: 0,
            explanation: "The Government of India Act, 1935, which had served as India's governing framework under British rule, was superseded when the Constitution of India came into effect on 26 January 1950.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The secret ballot system used in Indian elections is characterised by which feature?",
            options: [
              "Voters can cast their vote without disclosing their choice to anyone else",
              "Voting results are announced immediately after each vote",
              "Only party members are permitted to vote",
              "Votes are cast publicly by a show of hands",
            ],
            correct: 0,
            explanation: "Under the secret ballot system, each voter casts their vote in privacy, without being required or able to disclose their choice to others, protecting them from pressure or intimidation.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The adoption of the Preamble to the Indian Constitution was significantly inspired by the ideals expressed in the:",
            options: [
              "French and American declarations of rights and constitutions",
              "Magna Carta alone",
              "Soviet Constitution alone",
              "Government of India Act, 1935",
            ],
            correct: 0,
            explanation: "The Preamble's ideals of liberty, equality and fraternity draw inspiration from the French Declaration of the Rights of Man and the American Declaration of Independence and Constitution.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The system of Parliamentary government adopted in the Indian Constitution, with a Council of Ministers responsible to the legislature, was primarily inspired by:",
            options: ["The British system of government", "The American presidential system", "The Swiss confederal model", "The French semi-presidential model"],
            correct: 0,
            explanation: "India adopted a Parliamentary system of government, modelled on the British Westminster system, in which the executive (Council of Ministers) is collectively responsible to the elected legislature.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following situations would amount to a violation of the right to equality under Article 14 of the Constitution?",
            options: [
              "A public educational institution denies a student admission solely on the basis of religion",
              "A private club charges a membership fee",
              "The government reserves seats for economically weaker sections",
              "A school sets a minimum qualifying mark for admission",
            ],
            correct: 0,
            explanation: "Article 14 guarantees equality before the law; a public institution denying admission purely on the ground of religion amounts to unconstitutional discrimination, unlike reasonable, non-discriminatory eligibility criteria.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "If a law passed by a two-thirds majority in Parliament is believed by a citizen to violate their fundamental rights, what legal recourse is available to them?",
            options: [
              "They can directly petition the Supreme Court challenging the law's constitutionality",
              "They have no legal recourse since it was passed by a large majority",
              "They must first get the President's approval to challenge it",
              "They can only approach the United Nations",
            ],
            correct: 0,
            explanation: "Under Article 32, a citizen can move the Supreme Court directly to challenge any law — regardless of the parliamentary majority by which it was passed — if it is believed to violate fundamental rights, since fundamental rights are protected against ordinary legislative majorities.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Article 243A of the Indian Constitution mandates the establishment of which grassroots democratic institution?",
            options: ["Gram Sabha", "Zila Parishad", "State Election Commission", "Finance Commission"],
            correct: 0,
            explanation: "Article 243A, inserted by the 73rd Amendment, provides that a Gram Sabha — a village assembly of all registered voters — may exercise powers at the village level as specified by state legislation.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Inter-State Council, created to facilitate coordination and discussion between the Union and the States, is established under which Article of the Constitution?",
            options: ["Article 263", "Article 280", "Article 356", "Article 370"],
            correct: 0,
            explanation: "Article 263 empowers the President to establish an Inter-State Council to inquire into and discuss subjects of common interest between the Union and the States, or between States.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The Preamble to the Indian Constitution describes India as a:",
            options: [
              "Sovereign Socialist Secular Democratic Republic",
              "Sovereign Capitalist Secular Republic",
              "Sovereign Socialist Theocratic Republic",
              "Federal Presidential Republic",
            ],
            correct: 0,
            explanation: "The Preamble (as amended by the 42nd Amendment) describes India as a Sovereign, Socialist, Secular, Democratic Republic, committed to Justice, Liberty, Equality and Fraternity.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "During which constitutional emergency provision are the protections of Articles 20 and 21 explicitly NOT suspended, unlike other fundamental rights, under Article 359?",
            options: ["Both Article 20 and Article 21 remain protected", "Only Article 20 remains protected", "Only Article 21 remains protected", "Neither is protected during an emergency"],
            correct: 0,
            explanation: "Article 359, which allows the President to suspend the right to move courts for enforcement of fundamental rights during a national emergency, explicitly excludes Articles 20 (protection in respect of conviction) and 21 (right to life and personal liberty) from suspension.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Sub-Committee on Fundamental Rights of the Constituent Assembly was headed by:",
            options: ["J.B. Kripalani", "B.R. Ambedkar", "Sardar Vallabhbhai Patel", "Jawaharlal Nehru"],
            correct: 0,
            explanation: "The Fundamental Rights Sub-Committee of the Constituent Assembly was chaired by J.B. Kripalani, which drafted the provisions later debated and adopted as Part III of the Constitution.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following is NOT listed among the Fundamental Rights guaranteed by the Indian Constitution today?",
            options: ["Right to Property", "Right to Equality", "Right to Freedom of Religion", "Right to Constitutional Remedies"],
            correct: 0,
            explanation: "The Right to Property was removed from the list of Fundamental Rights by the 44th Amendment (1978) and made a legal right under Article 300A instead; the other rights listed remain Fundamental Rights.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The impeachment of the President of India for violation of the Constitution requires a resolution passed by which majority in Parliament?",
            options: ["A two-thirds majority of the total membership of each House", "A simple majority in the Lok Sabha alone", "A three-fourths majority in a joint sitting", "A majority of state legislatures"],
            correct: 0,
            explanation: "Under Article 61, the President can be impeached only through a resolution passed by a two-thirds majority of the total membership of each House of Parliament, following the procedure laid down in the Constitution.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which Schedule of the Indian Constitution, added by the 74th Amendment, deals with the powers and functions of Municipalities?",
            options: ["Twelfth Schedule", "Eleventh Schedule", "Ninth Schedule", "Tenth Schedule"],
            correct: 0,
            explanation: "The Twelfth Schedule, added by the 74th Constitutional Amendment (1992), lists 18 functional areas that may be entrusted to Municipalities, such as urban planning and public health.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Who is known as the 'Father of the Indian Constitution'?",
            options: ["Jawaharlal Nehru", "B. R. Ambedkar", "Rajendra Prasad", "Sardar Patel"],
            correct: 1,
            explanation: "Dr. B. R. Ambedkar chaired the Drafting Committee and is regarded as the chief architect of the Constitution.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Fundamental Duties were added to the Indian Constitution by which amendment?",
            options: ["42nd Amendment", "44th Amendment", "52nd Amendment", "86th Amendment"],
            correct: 0,
            explanation: "The 42nd Amendment Act, 1976 added Part IV-A (Article 51A) containing the Fundamental Duties.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2020,
          }),
          q({
            text: "The Right to Property is currently classified as which type of right in India?",
            options: ["Fundamental Right", "Legal Right", "Natural Right", "Directive Principle"],
            correct: 1,
            explanation: "After the 44th Amendment (1978), the Right to Property was removed as a Fundamental Right and made a legal right under Article 300A.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
      {
        slug: "governance",
        name: "Governance",
        questions: [
          q({
            text: "The election symbol 'Clock' is officially allotted to which Indian political party?",
            options: ["Nationalist Congress Party", "Bahujan Samaj Party", "Samajwadi Party", "Trinamool Congress"],
            correct: 0,
            explanation: "The 'Clock' was allotted as the election symbol of the Nationalist Congress Party (NCP), founded in 1999.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following statements about a Municipal Corporation in India is INCORRECT?",
            options: [
              "It has five separate governing authorities",
              "It is headed by a Mayor",
              "It governs large urban areas with substantial population",
              "Its members are elected by the residents of the city",
            ],
            correct: 0,
            explanation: "A Municipal Corporation is typically governed through three main authorities — the Council, the Standing Committees, and the Commissioner — not five, making the claim of 'five authorities' incorrect.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following states/union territories does NOT have a three-tier Panchayati Raj system, unlike most other Indian states?",
            options: ["Tripura (Tribal Areas Autonomous District Council regions)", "Maharashtra", "Uttar Pradesh", "Rajasthan"],
            correct: 0,
            explanation: "Areas covered under the Sixth Schedule, such as the tribal autonomous district council regions of Tripura, are exempt from the standard three-tier Panchayati Raj structure introduced by the 73rd Amendment.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "India's federal system of government, dividing powers between the Union and the States through a written Constitution, was significantly influenced by the federal model of:",
            options: ["Canada", "Switzerland", "Australia", "Germany"],
            correct: 0,
            explanation: "India's federal structure, particularly the idea of a strong Centre with residual powers vested in the Union, was significantly influenced by the Canadian model of federalism.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Disputes between states over the sharing of interstate river waters are adjudicated primarily through a mechanism established by:",
            options: ["Parliament (via tribunals under the Inter-State River Water Disputes Act)", "The President acting alone", "State High Courts only", "The Election Commission"],
            correct: 0,
            explanation: "Under Article 262, Parliament can by law provide for the adjudication of interstate river water disputes, and has done so through the Inter-State River Water Disputes Act, 1956, which establishes tribunals for this purpose.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following regional party-state pairs is/are correctly matched? I. Dravida Munnetra Kazhagam - Tamil Nadu. II. Aam Aadmi Party - Delhi. III. Shiromani Akali Dal - Haryana.",
            options: ["Only I and II are correctly matched", "Only III is correctly matched", "All three are correctly matched", "None are correctly matched"],
            correct: 0,
            explanation: "The DMK is a major regional party of Tamil Nadu and the Aam Aadmi Party is based in Delhi; the Shiromani Akali Dal, however, is a Punjab-based party, not a Haryana party, making statement III incorrect.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Under the Seventh Schedule of the Constitution, which of the following subject-list assignments is/are correct? I. Fisheries - State List. II. Civil Procedure - Concurrent List. III. Railways - Union List.",
            options: ["All three (I, II and III) are correctly assigned", "Only I is correct", "Only II and III are correct", "None are correct"],
            correct: 0,
            explanation: "Fisheries falls under the State List, Civil Procedure is placed in the Concurrent List, and Railways is a Union List subject — all three assignments given are correct.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Article 243ZA of the Indian Constitution deals with elections to which local self-government bodies?",
            options: ["Municipalities", "Panchayats", "State Legislatures", "District Courts"],
            correct: 0,
            explanation: "Article 243ZA vests the superintendence, direction and control of elections to Municipalities in the State Election Commission, paralleling Article 243K's provision for Panchayats.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "A key difference between a political party and a pressure group is that:",
            options: [
              "A political party seeks to win political power and form the government, while a pressure group does not",
              "A pressure group always has more members than a political party",
              "Only political parties can hold public rallies",
              "Pressure groups are always illegal",
            ],
            correct: 0,
            explanation: "Political parties contest elections and seek to capture political power to form the government, whereas pressure groups seek to influence government policy without themselves seeking to hold office.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which state has the largest state legislative assembly (Vidhan Sabha) in India, by number of members?",
            options: ["Uttar Pradesh", "Maharashtra", "West Bengal", "Bihar"],
            correct: 0,
            explanation: "Uttar Pradesh has the largest state legislative assembly in India, reflecting its status as the most populous state.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "One key requirement for a democracy to function effectively when citizens and the press oppose a restrictive new law is that:",
            options: [
              "The government should be willing to amend or withdraw the law in response to public feedback",
              "The government should ignore public opposition to maintain stability",
              "The judiciary should be barred from reviewing the law",
              "Elections should be suspended until the controversy settles",
            ],
            correct: 0,
            explanation: "A functioning democracy requires that governments remain responsive and accountable to public opinion — including press freedom and citizen protest — and be willing to reconsider or amend laws that face widespread opposition.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The purpose of having a bicameral legislature (two houses) in a federal system, with an upper house representing states/regions, is to:",
            options: [
              "Give proportionate representation to different regions or states within the federation",
              "Speed up the law-making process",
              "Eliminate the need for a written constitution",
              "Reduce the power of the judiciary",
            ],
            correct: 0,
            explanation: "In a federal system, a bicameral legislature typically has an upper house (like India's Rajya Sabha) that represents the states or regions, ensuring their voice in national law-making regardless of population size.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Which of the following is a typical function performed by local (municipal) government bodies in India?",
            options: ["Maintenance of public health facilities and local roads", "Conducting national elections", "Framing foreign policy", "Issuing currency"],
            correct: 0,
            explanation: "Local government bodies such as municipalities and panchayats are responsible for civic functions like public health, sanitation, water supply and maintenance of local roads.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Which of the following would NOT be considered a feature of a federal system of government?",
            options: [
              "All power is vested exclusively with the central government",
              "There are at least two levels (or tiers) of government",
              "Different tiers of government govern the same citizens over different subjects",
              "The Constitution guarantees the existence and authority of each level of government",
            ],
            correct: 0,
            explanation: "Concentrating all power exclusively with the central government describes a unitary, not federal, system; federalism requires power to be constitutionally divided between the centre and the units/states.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "One of the primary benefits of power-sharing under a federal system is that it:",
            options: [
              "Increases people's participation in governance at different levels",
              "Eliminates all political conflict between regions",
              "Removes the need for elections at the state level",
              "Concentrates decision-making entirely at the centre",
            ],
            correct: 0,
            explanation: "By distributing power across multiple levels of government, federalism brings decision-making closer to the people, increasing their participation in governance at the local, state and national levels.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "A key feature/criticism of the First-Past-The-Post (FPTP) electoral system, as used in Indian Lok Sabha elections, is that it:",
            options: [
              "Often results in a winning candidate securing power without an outright majority of votes cast",
              "Guarantees proportional representation to every party",
              "Requires voters to rank candidates in order of preference",
              "Eliminates the possibility of a hung Parliament",
            ],
            correct: 0,
            explanation: "Under FPTP, the candidate with the most votes in a constituency wins even without securing 50% of votes, meaning a majority of voters may have voted against the winner — a frequently noted feature of the system.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The voting age in India was lowered from 21 to 18 years through which Constitutional Amendment?",
            options: ["61st Amendment (1989)", "42nd Amendment (1976)", "73rd Amendment (1992)", "52nd Amendment (1985)"],
            correct: 0,
            explanation: "The 61st Constitutional Amendment Act of 1989 lowered the minimum voting age in India from 21 to 18 years.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Deliberative democracy is best defined as a form of democracy that:",
            options: [
              "Promotes citizen participation in public discussion and deliberation before decisions are made",
              "Concentrates all decisions in the hands of experts",
              "Eliminates elections in favour of direct rule",
              "Restricts participation to elected representatives alone",
            ],
            correct: 0,
            explanation: "Deliberative democracy emphasises reasoned public discussion and citizen deliberation as central to legitimate decision-making, rather than decisions being made solely by elites or through majority vote alone.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "The term 'post-democracy', coined by political scientist Colin Crouch, refers to a situation where:",
            options: [
              "Democratic institutions persist formally, but real power becomes concentrated in the hands of a narrow elite",
              "Democracy is formally abolished and replaced by dictatorship",
              "All elections are cancelled",
              "Power is transferred entirely to international organisations",
            ],
            correct: 0,
            explanation: "Colin Crouch used 'post-democracy' to describe a condition where formal democratic institutions like elections continue, but real influence over policy is captured by corporate and elite interests, hollowing out genuine popular control.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2025,
          }),
          q({
            text: "Under Nepal's earlier Panchayat system, King Mahendra — who curtailed multi-party democracy in 1960 — was succeeded by his son, who ascended as:",
            options: ["King Birendra", "King Tribhuvan", "King Gyanendra", "King Prithvi Narayan Shah"],
            correct: 0,
            explanation: "King Mahendra, who established the Panchayat system in Nepal, was succeeded by his son King Birendra in 1972, who continued the system before multi-party democracy was restored in 1990.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Bolivia's early-2000s political struggle over the privatisation of water supply and natural resources is best described by which statement(s)? I. It involved mass protests demanding public control over resources. II. It led to significant changes in government policy under public pressure.",
            options: ["Both statements are correct", "Only statement I is correct", "Only statement II is correct", "Neither statement is correct"],
            correct: 0,
            explanation: "Bolivia's 'Water War' (2000) saw mass protests against the privatisation of the Cochabamba water supply, which succeeded in reversing the privatisation policy under sustained public pressure — illustrating people's power in a democracy.",
            difficulty: Difficulty.HARD,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "Which of the following is NOT typically considered a type of urban local government body in India?",
            options: ["Public Undertakings Committee", "Municipal Corporation", "Municipal Council", "Nagar Panchayat"],
            correct: 0,
            explanation: "The Public Undertakings Committee is a parliamentary/legislative committee examining public sector enterprises, not a form of urban local government; Municipal Corporations, Councils and Nagar Panchayats are the standard forms of urban local bodies.",
            difficulty: Difficulty.MEDIUM,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "At the village level, a Gram Panchayat is headed by an elected representative known as the:",
            options: ["Pradhan (Sarpanch)", "Mukhiya alone", "Zila Adhyaksh", "Block Development Officer"],
            correct: 0,
            explanation: "A Gram Panchayat is headed by an elected Pradhan (also called Sarpanch in some states), who presides over its meetings and functions.",
            difficulty: Difficulty.EASY,
            isPYQ: true,
            pyqYear: 2021,
          }),
          q({
            text: "The Union Council of Ministers is collectively responsible to which body?",
            options: ["The President", "The Rajya Sabha", "The Lok Sabha", "The Supreme Court"],
            correct: 2,
            explanation: "Under Article 75(3), the Council of Ministers is collectively responsible to the Lok Sabha.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Panchayati Raj Institutions were given constitutional status by which amendment?",
            options: ["71st Amendment", "73rd Amendment", "74th Amendment", "76th Amendment"],
            correct: 1,
            explanation: "The 73rd Amendment Act, 1992 gave constitutional status to Panchayati Raj Institutions.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Who appoints the Chief Election Commissioner of India?",
            options: ["Prime Minister", "Chief Justice of India", "President of India", "Parliament"],
            correct: 2,
            explanation: "The President of India appoints the Chief Election Commissioner and other Election Commissioners.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
    ],
  },
  {
    slug: "mathematics",
    name: "Mathematics",
    topics: [
      {
        slug: "arithmetic",
        name: "Arithmetic",
        questions: [
          q({
            text: "A sum of ₹1,200 is invested at 10% simple interest per annum. What is the interest after 2 years?",
            options: ["₹120", "₹200", "₹240", "₹300"],
            correct: 2,
            explanation: "SI = (P × R × T)/100 = (1200 × 10 × 2)/100 = ₹240.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "If the ratio of two numbers is 3:5 and their sum is 96, what is the larger number?",
            options: ["36", "48", "60", "72"],
            correct: 2,
            explanation: "Parts = 3+5 = 8; each part = 96/8 = 12; larger number = 5 × 12 = 60.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "A train covers 360 km in 4 hours. What is its speed in m/s?",
            options: ["20 m/s", "25 m/s", "30 m/s", "35 m/s"],
            correct: 1,
            explanation: "Speed = 360/4 = 90 km/h = 90 × 5/18 = 25 m/s.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "algebra",
        name: "Algebra",
        questions: [
          q({
            text: "If x + 1/x = 5, what is the value of x² + 1/x²?",
            options: ["21", "23", "25", "27"],
            correct: 1,
            explanation: "x² + 1/x² = (x + 1/x)² − 2 = 25 − 2 = 23.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "What are the roots of the equation x² − 5x + 6 = 0?",
            options: ["1, 6", "2, 3", "−2, −3", "2, −3"],
            correct: 1,
            explanation: "Factoring: (x − 2)(x − 3) = 0, so x = 2 or x = 3.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "The sum of first 20 natural numbers is:",
            options: ["190", "200", "210", "220"],
            correct: 2,
            explanation: "Sum = n(n+1)/2 = 20 × 21/2 = 210.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
    ],
  },
  {
    slug: "reasoning",
    name: "Reasoning",
    topics: [
      {
        slug: "verbal-reasoning",
        name: "Verbal Reasoning",
        questions: [
          q({
            text: "Find the odd one out: Apple, Mango, Potato, Banana",
            options: ["Apple", "Mango", "Potato", "Banana"],
            correct: 2,
            explanation: "Potato is a vegetable/tuber; the rest are fruits.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "If 'CAT' is coded as '24-2-42', what is the code for 'DOG'?",
            options: ["4-30-14", "8-30-14", "4-60-14", "8-60-14"],
            correct: 1,
            explanation: "Each letter's position number is doubled: D(4)→8, O(15)→30, G(7)→14, giving 8-30-14.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "Complete the series: 2, 6, 12, 20, 30, ?",
            options: ["36", "40", "42", "44"],
            correct: 2,
            explanation: "Differences increase by 2 each time (4,6,8,10,12); 30 + 12 = 42.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "non-verbal-reasoning",
        name: "Non-Verbal & Analytical",
        questions: [
          q({
            text: "Pointing to a photo, a man said, 'She is the daughter of my grandfather's only son.' How is the woman related to the man?",
            options: ["Mother", "Sister", "Aunt", "Wife"],
            correct: 1,
            explanation: "The man's grandfather's only son is the man's father, so the daughter is the man's sister.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "In a certain code, 'GARDEN' is written as 'HBSEFO'. How is 'FLOWER' written in that code?",
            options: ["GMPXFS", "GMXPFS", "GMPXSF", "GNPXFS"],
            correct: 0,
            explanation: "Each letter is shifted forward by one place in the alphabet: F→G, L→M, O→P, W→X, E→F, R→S.",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "How many triangles are typically counted in a standard five-pointed star (pentagram) figure?",
            options: ["5", "10", "11", "15"],
            correct: 2,
            explanation: "A pentagram figure commonly yields 11 triangles when all overlapping triangles are counted.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
    ],
  },
  {
    slug: "hindi",
    name: "Hindi",
    topics: [
      {
        slug: "vyakaran",
        name: "व्याकरण (Grammar)",
        questions: [
          q({
            text: "'सूर्य' शब्द का पर्यायवाची शब्द कौन-सा है?",
            options: ["चंद्रमा", "दिनकर", "समीर", "जलधि"],
            correct: 1,
            explanation: "'दिनकर' सूर्य का पर्यायवाची शब्द है।",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "'अंधकार' शब्द का विलोम शब्द बताइए।",
            options: ["प्रकाश", "काला", "रात्रि", "छाया"],
            correct: 0,
            explanation: "'अंधकार' का विलोम शब्द 'प्रकाश' है।",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "'जो कठिनाई से प्राप्त हो' के लिए एक शब्द है:",
            options: ["सुलभ", "दुर्लभ", "सुगम", "अगम्य"],
            correct: 1,
            explanation: "'जो कठिनाई से प्राप्त हो' के लिए उपयुक्त शब्द 'दुर्लभ' है।",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "sahitya",
        name: "साहित्य (Literature)",
        questions: [
          q({
            text: "'गोदान' उपन्यास के रचयिता कौन हैं?",
            options: ["जयशंकर प्रसाद", "मुंशी प्रेमचंद", "महादेवी वर्मा", "सुमित्रानंदन पंत"],
            correct: 1,
            explanation: "'गोदान' मुंशी प्रेमचंद द्वारा रचित प्रसिद्ध उपन्यास है।",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "हिंदी की पहली मौलिक कहानी 'इंदुमती' के लेखक कौन हैं?",
            options: ["किशोरीलाल गोस्वामी", "प्रेमचंद", "जयशंकर प्रसाद", "चंद्रधर शर्मा गुलेरी"],
            correct: 0,
            explanation: "'इंदुमती' किशोरीलाल गोस्वामी द्वारा लिखी गई मानी जाती है, जिसे हिंदी की पहली मौलिक कहानी कहा जाता है।",
            difficulty: Difficulty.HARD,
          }),
          q({
            text: "'कामायनी' महाकाव्य के रचयिता कौन हैं?",
            options: ["सूर्यकांत त्रिपाठी 'निराला'", "जयशंकर प्रसाद", "रामधारी सिंह 'दिनकर'", "सुमित्रानंदन पंत"],
            correct: 1,
            explanation: "'कामायनी' जयशंकर प्रसाद द्वारा रचित छायावादी महाकाव्य है।",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
    ],
  },
  {
    slug: "english",
    name: "English",
    topics: [
      {
        slug: "grammar",
        name: "Grammar",
        questions: [
          q({
            text: "Choose the correctly spelled word.",
            options: ["Recieve", "Receive", "Receeve", "Receve"],
            correct: 1,
            explanation: "The correct spelling follows the rule 'i before e except after c': Receive.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Fill in the blank: She ___ to the market every day.",
            options: ["go", "goes", "going", "gone"],
            correct: 1,
            explanation: "Subject-verb agreement: singular subject 'She' takes 'goes' in simple present tense.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "Identify the correctly punctuated sentence.",
            options: [
              "Its a beautiful day, isnt it?",
              "It's a beautiful day, isn't it?",
              "Its' a beautiful day, isnt' it?",
              "It's a beautiful day, isn't it",
            ],
            correct: 1,
            explanation: "'It's' (it is) and 'isn't' (is not) need apostrophes, and the sentence should end with a question mark.",
            difficulty: Difficulty.MEDIUM,
          }),
        ],
      },
      {
        slug: "vocabulary",
        name: "Vocabulary",
        questions: [
          q({
            text: "Choose the word most nearly opposite in meaning to 'BENEVOLENT'.",
            options: ["Kind", "Malevolent", "Generous", "Charitable"],
            correct: 1,
            explanation: "'Benevolent' means kind and generous; its antonym is 'malevolent' (having evil intentions).",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Choose the word most nearly similar in meaning to 'ABUNDANT'.",
            options: ["Scarce", "Plentiful", "Limited", "Rare"],
            correct: 1,
            explanation: "'Abundant' means existing in large quantities, synonymous with 'plentiful'.",
            difficulty: Difficulty.EASY,
          }),
          q({
            text: "'To beat around the bush' means:",
            options: [
              "To speak directly",
              "To avoid the main topic",
              "To argue loudly",
              "To finish quickly",
            ],
            correct: 1,
            explanation: "This idiom means to avoid talking about the main issue directly.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
    ],
  },
  {
    slug: "current-affairs",
    name: "Current Affairs",
    topics: [
      {
        slug: "national",
        name: "National",
        questions: [
          q({
            text: "The 'PM Gati Shakti' initiative is primarily related to which sector?",
            options: [
              "Multi-modal infrastructure connectivity",
              "Digital banking",
              "Agricultural subsidy",
              "Higher education reform",
            ],
            correct: 0,
            explanation:
              "PM Gati Shakti is a National Master Plan for multi-modal connectivity to integrate infrastructure planning across ministries.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "Which Indian city hosted the G20 Leaders' Summit in 2023?",
            options: ["Mumbai", "New Delhi", "Bengaluru", "Jaipur"],
            correct: 1,
            explanation: "India hosted the G20 Leaders' Summit in New Delhi in September 2023.",
            difficulty: Difficulty.EASY,
          }),
        ],
      },
      {
        slug: "schemes-and-awards",
        name: "Schemes & Awards",
        questions: [
          q({
            text: "The 'Beti Bachao Beti Padhao' scheme was launched in which year?",
            options: ["2012", "2014", "2015", "2017"],
            correct: 2,
            explanation: "The scheme was launched on 22 January 2015 in Panipat, Haryana.",
            difficulty: Difficulty.MEDIUM,
          }),
          q({
            text: "The Bharat Ratna is India's highest civilian award; who can recommend a name for it?",
            options: [
              "Only the Prime Minister",
              "Any citizen can recommend, decided by the PM's recommendation to the President",
              "Only Parliament",
              "Only the Supreme Court",
            ],
            correct: 1,
            explanation:
              "Recommendations for Bharat Ratna can come from anyone, but the final decision rests with the Prime Minister, who recommends it to the President.",
            difficulty: Difficulty.HARD,
          }),
        ],
      },
    ],
  },
];

async function main() {
  for (let i = 0; i < SUBJECTS.length; i++) {
    const s = SUBJECTS[i];
    const subject = await prisma.subject.upsert({
      where: { slug: s.slug },
      update: { name: s.name, order: i },
      create: { slug: s.slug, name: s.name, order: i },
    });

    for (let j = 0; j < s.topics.length; j++) {
      const t = s.topics[j];
      const topic = await prisma.topic.upsert({
        where: { subjectId_slug: { subjectId: subject.id, slug: t.slug } },
        update: { name: t.name, order: j },
        create: { subjectId: subject.id, slug: t.slug, name: t.name, order: j },
      });

      for (let k = 0; k < t.questions.length; k++) {
        const seedQ = t.questions[k];
        const existing = await prisma.question.findFirst({
          where: { topicId: topic.id, text: seedQ.text },
          select: { id: true },
        });
        if (existing) {
          await prisma.question.update({
            where: { id: existing.id },
            data: { ...seedQ, order: k },
          });
        } else {
          await prisma.question.create({
            data: { ...seedQ, topicId: topic.id, order: k },
          });
        }
      }
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
