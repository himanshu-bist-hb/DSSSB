// Adds the SST previous-year questions that were not yet in the question bank.
//   - DSSSB TGT Social Science, 10 Oct 2021 Shift-I (Female)  -> pyqYear 2021
//   - DSSSB TGT Social Science, 04 Nov 2025 Shift-2           -> pyqYear 2025
// Only the SST disciplines are covered (History, Geography, Economics, Political
// Science); General Awareness / current affairs, reasoning, maths, languages and
// teaching methodology sections of the papers are intentionally left out.
//
// Run with: npm run db:seed:pyq-sst   (idempotent - matches on topic + question text)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import sql from "mssql";

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

type Difficulty = "EASY" | "MEDIUM" | "HARD";
const OPT_IDS = ["a", "b", "c", "d"] as const;

type PyqInput = {
  subject: string;
  topic: string;
  year: 2021 | 2025;
  difficulty: Difficulty;
  text: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explanation: string;
};

const Q: PyqInput[] = [
  // ───────────────────────── HISTORY ─────────────────────────
  {
    subject: "history", topic: "age-of-industrialisation-class10", year: 2025, difficulty: "MEDIUM",
    text: "Which invention made it possible to produce thread on a large scale and thereby brought a revolution in the textile industry?",
    options: ["Power loom", "Cotton gin", "Spinning jenny", "Steam engine"],
    correct: 2,
    explanation: "The spinning jenny (James Hargreaves, c. 1764) allowed one worker to operate several spindles at once, multiplying the output of thread and triggering the mechanisation of the textile industry. The power loom mechanised weaving, the cotton gin separated cotton fibre from seeds, and the steam engine was a power source rather than a spinning device.",
  },
  {
    subject: "history", topic: "making-of-a-global-world-class10", year: 2025, difficulty: "EASY",
    text: "'Black Thursday' is associated with which of the following?",
    options: ["Nazism", "The Industrial Revolution", "The Great Depression", "Fascism"],
    correct: 2,
    explanation: "On Thursday, 24 October 1929 share prices on the New York Stock Exchange (Wall Street) collapsed. This 'Black Thursday' marked the start of the Great Depression, the worldwide economic slump of the 1930s.",
  },
  {
    subject: "history", topic: "french-revolution-class9", year: 2025, difficulty: "EASY",
    text: "Which former king of France was publicly guillotined in 1793 during the French Revolution?",
    options: ["Louis XV", "Louis XVI", "Louis XIV", "Napoleon Bonaparte"],
    correct: 1,
    explanation: "Louis XVI was tried for treason by the National Convention and guillotined on 21 January 1793 in Paris. Louis XV and Louis XIV died as reigning monarchs before the Revolution, and Napoleon rose to power only after it.",
  },
  {
    subject: "history", topic: "modern-india", year: 2025, difficulty: "MEDIUM",
    text: "Who is the author of the book 'India Today'?",
    options: ["R. Palme Dutt", "C. Rajagopalachari", "R. C. Dutt", "Jawaharlal Nehru"],
    correct: 0,
    explanation: "'India Today' (1940) was written by Rajani Palme Dutt, a British Marxist thinker, and gives a Marxist analysis of British colonial rule in India. Do not confuse him with R. C. Dutt, who wrote 'The Economic History of India'.",
  },
  {
    subject: "history", topic: "nationalism-in-india-class10", year: 2025, difficulty: "MEDIUM",
    text: "In which movement did Gandhiji make untouchability a public issue?",
    options: ["Non-Cooperation Movement", "Bardoli Satyagraha", "Quit India Movement", "Civil Disobedience Movement"],
    correct: 3,
    explanation: "During the Civil Disobedience Movement Gandhiji brought untouchability into the centre of the national struggle. He called the 'untouchables' Harijans (children of God), urged Congress workers to work for their upliftment and, after the Poona Pact (1932), founded the Harijan Sevak Sangh.",
  },
  {
    subject: "history", topic: "revolt-of-1857-class8", year: 2025, difficulty: "MEDIUM",
    text: "After the suppression of the 1857 revolt, Queen Victoria's proclamation was put into effect through which of the following?",
    options: ["The Government of India Act", "The Doctrine of Lapse", "The Charter Act", "The Indian Penal Code"],
    correct: 0,
    explanation: "The Government of India Act, 1858 ended the rule of the East India Company and transferred the government of India to the British Crown. Queen Victoria's Proclamation of 1 November 1858 announced this change and promised religious tolerance and no further annexation of Indian states. The Doctrine of Lapse was the pre-1857 annexation policy.",
  },
  {
    subject: "history", topic: "revolt-of-1857-class8", year: 2025, difficulty: "HARD",
    text: "According to Rudrangshu Mukherjee, at which place did the revolt of 1857 take the form of a 'Popular Movement'?",
    options: ["Bihar", "Jhansi", "Faizabad", "Awadh"],
    correct: 3,
    explanation: "In 'Awadh in Revolt, 1857-58: A Study of Popular Resistance', Rudrangshu Mukherjee shows that in Awadh the revolt was a mass movement. Deposed taluqdars, peasants and sepoys, many of them from Awadh itself, joined it after the annexation of the kingdom in 1856.",
  },
  {
    subject: "history", topic: "revolt-of-1857-class8", year: 2025, difficulty: "MEDIUM",
    text: "Which rebel leader of the 1857 revolt is traditionally held responsible for the killing of British women and children at Kanpur (the Bibighar incident)?",
    options: ["Nana Sahib", "Birjis Qadr", "Tantia Tope", "Kunwar Singh"],
    correct: 0,
    explanation: "Nana Sahib, the adopted son of the last Peshwa Baji Rao II, led the rebellion at Kanpur in 1857. The Bibighar killings of British women and children in July 1857 were traditionally attributed to his forces. Birjis Qadr was the rebel ruler of Lucknow, Tantia Tope was Nana Sahib's general and Kunwar Singh led the revolt in Bihar.",
  },
  {
    subject: "history", topic: "modern-india", year: 2025, difficulty: "MEDIUM",
    text: "The 'Brief Memorandum Outlining a Plan of Economic Development for India', prepared in 1944-45 by leading Indian industrialists, is popularly known as:",
    options: ["Calcutta Plan", "Delhi Plan", "Planning Commission Draft Outline", "Bombay Plan"],
    correct: 3,
    explanation: "The Bombay Plan was drawn up by industrialists such as J.R.D. Tata, G.D. Birla, Purshotamdas Thakurdas, Lala Shri Ram and Kasturbhai Lalbhai, with John Mathai and others. It proposed doubling per capita income in 15 years and gave the state a major role in heavy industry and infrastructure.",
  },
  {
    subject: "history", topic: "nazism-rise-of-hitler-class9", year: 2025, difficulty: "MEDIUM",
    text: "Which of the following countries was NOT among the Allied Powers in the First World War?",
    options: ["France", "Bulgaria", "Italy", "England"],
    correct: 1,
    explanation: "In the First World War the Allied (Entente) side comprised Britain (England), France, Russia, Italy (from 1915) and later the USA. Bulgaria joined the Central Powers along with Germany, Austria-Hungary and the Ottoman Empire, so it was not an Allied Power.",
  },
  {
    subject: "history", topic: "socialism-europe-russian-revolution-class9", year: 2021, difficulty: "EASY",
    text: "Who based his ideas on how to change the world on the scientific analysis of society through history?",
    options: ["Leonid Brezhnev", "Karl Marx", "Adam Smith", "Jeremy Bentham"],
    correct: 1,
    explanation: "Karl Marx, a revolutionary sociologist, historian and economist, propounded scientific socialism. He analysed how societies change through history (historical materialism) and argued that class struggle drives that change. Adam Smith was a classical economist, Bentham a utilitarian philosopher and Brezhnev a Soviet leader.",
  },
  {
    subject: "history", topic: "french-revolution-class9", year: 2021, difficulty: "EASY",
    text: "On which date was the Tennis Court Oath taken?",
    options: ["21 June 1789", "19 June 1789", "20 June 1789", "18 June 1789"],
    correct: 2,
    explanation: "On 20 June 1789 the deputies of the Third Estate found their meeting hall at Versailles locked and gathered in the nearby indoor tennis court. They declared themselves the National Assembly and swore not to disperse until a constitution for France had been drawn up.",
  },
  {
    subject: "history", topic: "nazism-rise-of-hitler-class9", year: 2021, difficulty: "MEDIUM",
    text: "Which of the following statements about the Treaty of Versailles are correct? I. It redrew the borders of Europe. II. Article 231 held Germany guilty of causing the war (the 'War Guilt Clause').",
    options: ["Both I and II", "Only I", "Only II", "Neither I nor II"],
    correct: 0,
    explanation: "The Treaty of Versailles (1919) took territory from Germany and redrew the map of Europe. Article 231, the War Guilt Clause, made Germany accept responsibility for the war and its losses, which formed the basis for reparations. Both statements are therefore correct.",
  },
  {
    subject: "history", topic: "socialism-europe-russian-revolution-class9", year: 2021, difficulty: "HARD",
    text: "Robert Owen was the first person to use the word 'Socialist' in his cooperative magazine in the year:",
    options: ["1825", "1826", "1824", "1827"],
    correct: 3,
    explanation: "Robert Owen, the English manufacturer and reformer who is regarded as a pioneer of utopian socialism and the cooperative movement, first used the word 'socialist' in the Co-operative Magazine in 1827.",
  },
  {
    subject: "history", topic: "making-of-a-global-world-class10", year: 2021, difficulty: "MEDIUM",
    text: "The UN Charter was signed on 26 June 1945 by representatives of how many countries?",
    options: ["50", "55", "45", "59"],
    correct: 0,
    explanation: "Representatives of 50 countries met at San Francisco in April 1945 to draft the UN Charter and signed it on 26 June 1945. Poland, which was not represented at the conference, signed later and became the 51st original member. The Charter came into force on 24 October 1945.",
  },
  {
    subject: "history", topic: "socialism-europe-russian-revolution-class9", year: 2021, difficulty: "MEDIUM",
    text: "Regarding the Communist Manifesto, which of the following statements is correct? I. It was written by Karl Marx and Charles Fourier and published in 1848. II. Their thought became the basis of the struggles of the oppressed.",
    options: ["Only I", "Both I and II", "Neither I nor II", "Only II"],
    correct: 3,
    explanation: "The Communist Manifesto was written by Karl Marx and Friedrich Engels, not Charles Fourier, and published in 1848, so statement I is wrong. Marxist thought did become the ideological basis of the struggles of exploited and oppressed people, so statement II is correct.",
  },
  {
    subject: "history", topic: "nazism-rise-of-hitler-class9", year: 2021, difficulty: "MEDIUM",
    text: "Which of the following is/are correctly matched? I. Soviet-German non-aggression pact - 1939. II. Treaty of Lausanne - 1923.",
    options: ["Both I and II", "Neither I nor II", "Only I", "Only II"],
    correct: 0,
    explanation: "The Molotov-Ribbentrop (Soviet-German non-aggression) Pact was signed in Moscow on 23 August 1939, with both sides agreeing not to attack each other for ten years. The Treaty of Lausanne was signed on 24 July 1923 and recognised the borders of modern Turkey. Both pairs are correct.",
  },
  {
    subject: "history", topic: "making-of-a-global-world-class10", year: 2021, difficulty: "EASY",
    text: "In which month and year did the USA intervene in the First World War in support of the Allies?",
    options: ["July 1917", "December 1917", "February 1918", "April 1917"],
    correct: 3,
    explanation: "The USA declared war on Germany on 6 April 1917, after German submarines sank American ships. Its entry gave the Allies fresh troops and resources and helped turn the war against the Central Powers.",
  },

  // ───────────────────────── GEOGRAPHY ─────────────────────────
  {
    subject: "geography", topic: "geomorphic-processes", year: 2025, difficulty: "MEDIUM",
    text: "Which of the following pairs is correctly matched?",
    options: [
      "Normal fault: a vertical movement in which rocks are pushed together",
      "Horst: a downward displacement of rock",
      "Strike-slip fault: a horizontal movement along the fault line",
      "Reverse fault: a vertical movement in which rocks are pulled apart",
    ],
    correct: 2,
    explanation: "In a strike-slip fault the blocks slide past each other horizontally along the fault line, as along the San Andreas Fault. In a normal fault the crust is pulled apart and one block moves down. A reverse fault is caused by compression, with rocks pushed together. A horst is an uplifted block between two faults; the downthrown block is a graben.",
  },
  {
    subject: "geography", topic: "solar-radiation-heat-balance-and-temperature", year: 2025, difficulty: "EASY",
    text: "Long-wave (terrestrial) radiation is absorbed by atmospheric gases, especially by:",
    options: ["Methane", "Carbon monoxide", "Carbon dioxide", "Nitrous oxide"],
    correct: 2,
    explanation: "The Earth re-radiates the heat it receives from the Sun as long-wave radiation. Carbon dioxide and water vapour absorb most of it and re-radiate part of it back to the surface, which produces the greenhouse effect. Carbon dioxide is the most important of the long-lived greenhouse gases listed.",
  },
  {
    subject: "geography", topic: "geomorphic-processes", year: 2025, difficulty: "EASY",
    text: "In weathering, expansion and contraction of rock can be caused by changes in:",
    options: ["Pressure", "Gravity", "Force", "Temperature"],
    correct: 3,
    explanation: "Temperature changes make rock minerals expand when heated and contract when cooled. Repeated heating by day and cooling by night, especially in deserts, produces cracks and flaking (exfoliation) and breaks the rock down through physical weathering.",
  },
  {
    subject: "geography", topic: "water-in-the-atmosphere", year: 2025, difficulty: "EASY",
    text: "What is the main factor that controls the rate of evaporation?",
    options: ["Air pressure", "Latitude", "Temperature", "Altitude"],
    correct: 2,
    explanation: "Higher temperature gives water molecules more energy, so evaporation is faster in warm conditions. Other factors such as wind, humidity and the exposed surface area also matter, but temperature is the main controlling factor.",
  },
  {
    subject: "geography", topic: "minerals-and-rocks", year: 2025, difficulty: "MEDIUM",
    text: "The process by which igneous rocks are converted into sedimentary rocks is called:",
    options: ["Metamorphism", "Crystallisation", "Weathering and erosion", "Volcanism"],
    correct: 2,
    explanation: "In the rock cycle, igneous rocks are broken down by weathering, the fragments are carried away by erosion, and the sediments are then deposited and compacted (lithified) into sedimentary rocks. Metamorphism forms metamorphic rocks and crystallisation of magma forms igneous rocks.",
  },
  {
    subject: "geography", topic: "distribution-of-oceans-and-continents", year: 2025, difficulty: "MEDIUM",
    text: "Which of the following is NOT related to the Theory of Plate Tectonics?",
    options: [
      "Movement of the Earth's crustal plates",
      "Sea-floor spreading",
      "Isostasy",
      "Formation of mid-oceanic ridges",
    ],
    correct: 2,
    explanation: "Plate tectonics explains the movement of lithospheric plates, sea-floor spreading and the formation of mid-oceanic ridges. Isostasy is a different idea: it describes the gravitational balance between the crust and the denser mantle beneath it, so it is not part of the plate tectonic theory.",
  },
  {
    subject: "geography", topic: "solar-radiation-heat-balance-and-temperature", year: 2025, difficulty: "MEDIUM",
    text: "Which process is important for heating the lowest layers of the atmosphere?",
    options: ["Advection", "Conduction", "Convection", "Radiation"],
    correct: 1,
    explanation: "The ground is heated by the Sun, and the air layer in contact with it is warmed by conduction, which is heat transfer by direct contact. This is why conduction heats the lowest layers of the atmosphere; the heat is then carried upward by convection.",
  },
  {
    subject: "geography", topic: "manufacturing-industries-india", year: 2025, difficulty: "MEDIUM",
    text: "Which of the following statements is related to large-scale industries?",
    options: [
      "Capital investment is less than Rs 1 crore.",
      "They manufacture goods in very small quantities.",
      "They generally require a large number of workers (more than a thousand).",
      "They generally employ fewer than a thousand workers.",
    ],
    correct: 2,
    explanation: "Large-scale industries such as iron and steel, cement and textile mills use heavy capital investment, advanced technology and mass production, and normally employ a large workforce of over a thousand workers. Small-scale industries are the ones with lower investment and small production.",
  },
  {
    subject: "geography", topic: "drainage-of-india", year: 2025, difficulty: "MEDIUM",
    text: "Which of the following rivers in India are called 'perennial' rivers?",
    options: [
      "Only monsoon-fed rivers",
      "Indus, Yamuna, Ganga, Kaveri",
      "Narmada and Tapi",
      "Only the rivers of South India",
    ],
    correct: 1,
    explanation: "Perennial rivers carry water throughout the year. The Himalayan rivers (Indus, Ganga, Yamuna) are fed by both rainfall and snow-melt. The Kaveri, although a peninsular river, has a fairly steady flow because it receives rain from both the south-west and the north-east monsoons. Rivers such as the Narmada and Tapi are largely rain-fed and have a much lower dry-season flow.",
  },
  {
    subject: "geography", topic: "drainage-of-india", year: 2025, difficulty: "EASY",
    text: "Which of the following rivers forms the largest delta in the world?",
    options: ["Ganga", "Mahanadi", "Krishna", "Narmada"],
    correct: 0,
    explanation: "The Ganga, together with the Brahmaputra, forms the Ganga-Brahmaputra (Sundarbans) delta, the largest delta in the world. The Mahanadi and Krishna form smaller deltas on the east coast, while the Narmada flows into the Arabian Sea through an estuary.",
  },
  {
    subject: "geography", topic: "natural-hazards-and-disasters-india", year: 2025, difficulty: "HARD",
    text: "In disaster management, which is the key element of 'contingency planning' that improves preparedness and response efficiency?",
    options: [
      "Designing context-specific response strategies supported by regular training drills and simulations",
      "Giving priority only to long-term development projects and neglecting the immediate response mechanism",
      "Depending entirely on international relief assistance without building local response capacity",
      "Focusing only on post-disaster rehabilitation measures without a pre-disaster preparedness plan",
    ],
    correct: 0,
    explanation: "Contingency planning prepares in advance for likely hazards. It sets out roles, resources and response strategies specific to the local context and tests them through regular training, drills and simulations. Ignoring immediate response, depending wholly on outside aid, or planning only for the post-disaster phase would weaken preparedness.",
  },
  {
    subject: "geography", topic: "manufacturing-industries-india", year: 2025, difficulty: "MEDIUM",
    text: "Which of the following is a characteristic of heavy industries in India?",
    options: [
      "They are generally located in rural areas.",
      "They mainly depend on labour-intensive processes.",
      "They directly produce consumer goods for the market.",
      "They generally require high capital and energy.",
    ],
    correct: 3,
    explanation: "Heavy industries such as iron and steel, cement and heavy machinery use bulky raw materials, large amounts of capital and a lot of energy. They are capital-intensive, located near raw materials and power, and mostly supply intermediate goods rather than consumer goods.",
  },
  {
    subject: "geography", topic: "agriculture-of-india", year: 2025, difficulty: "EASY",
    text: "Which crop is mainly associated with wet agriculture in India?",
    options: ["Wheat", "Rice", "Bajra", "Cotton"],
    correct: 1,
    explanation: "Rice needs high temperature, high humidity and heavy rainfall (or assured irrigation), and is grown in flooded fields, so it is the typical crop of wet agriculture. Wheat is a rabi crop of cooler, drier conditions, and bajra is grown in dry areas.",
  },
  {
    subject: "geography", topic: "landforms-and-their-evolution", year: 2021, difficulty: "MEDIUM",
    text: "The swarms of rounded hummocks resulting from the deposition of glacial till are called:",
    options: ["Eskers", "Outwash plains", "Drumlins", "Moraines"],
    correct: 2,
    explanation: "Drumlins are smooth, elongated oval hills made of glacial till and shaped like an inverted boat or a half-buried egg. They usually occur in swarms, giving 'basket of eggs' topography. Eskers are sinuous ridges of stratified sand and gravel, and moraines are irregular deposits of till.",
  },
  {
    subject: "geography", topic: "water-in-the-atmosphere", year: 2021, difficulty: "EASY",
    text: "Dew point temperature is expressed in which of the following? I. Celsius. II. Fahrenheit.",
    options: ["Only II", "Only I", "Neither I nor II", "Both I and II"],
    correct: 3,
    explanation: "The dew point is the temperature at which air becomes saturated and condensation begins. Like any temperature it can be expressed in either the Celsius or the Fahrenheit scale, so both statements are correct.",
  },
  {
    subject: "geography", topic: "interior-of-the-earth", year: 2021, difficulty: "HARD",
    text: "Who was the first scientist to devise an instrument used to detect earthquakes?",
    options: ["Chang Heng", "George Cuvier", "Alfred Wegener", "D. E. R. Ward-Neale"],
    correct: 0,
    explanation: "Chang Heng, a Chinese philosopher and scientist of the Han dynasty, invented the first seismoscope in about 132 CE. It was a large bronze vessel with eight dragon heads facing the eight main compass directions, and a ball dropped from the dragon's mouth to show the direction of an earthquake. Alfred Wegener is known for continental drift.",
  },
  {
    subject: "geography", topic: "minerals-and-energy-resources-india", year: 2021, difficulty: "MEDIUM",
    text: "Which of the following mineral resources is non-metallic in nature?",
    options: ["Platinum", "Chromium", "Manganese", "Asbestos"],
    correct: 3,
    explanation: "Non-metallic minerals contain no metal and are usually brittle, for example asbestos, limestone, mica, gypsum, salt and pyrite. Platinum, chromium and manganese are metallic minerals.",
  },

  // ───────────────────────── ECONOMICS ─────────────────────────
  {
    subject: "economics", topic: "basic-concepts", year: 2025, difficulty: "EASY",
    text: "Which system was replaced by money as the medium of exchange in India?",
    options: ["Loan system", "Currency system", "Barter (commodity-exchange) system", "Moneylender system"],
    correct: 2,
    explanation: "Under the barter system goods were exchanged directly for other goods, which needed a 'double coincidence of wants'. Money solved this problem by acting as a common medium of exchange and a measure of value, and so replaced barter.",
  },
  {
    subject: "economics", topic: "indian-economy", year: 2025, difficulty: "EASY",
    text: "What is a positive impact of globalisation on employment in the industrial sector?",
    options: [
      "It increases employment opportunities.",
      "It reduces employment opportunities.",
      "It reduces the demand for labour.",
      "It has no particular effect.",
    ],
    correct: 0,
    explanation: "Globalisation brings foreign investment, multinational companies, larger export markets and new technology. These expand industrial production and services and create more jobs in the industrial sector, although competition can also hurt some small producers.",
  },

  // ───────────────────────── POLITICAL SCIENCE ─────────────────────────
  {
    subject: "political-science", topic: "governance", year: 2025, difficulty: "MEDIUM",
    text: "What is the nature of the relationship between democracy and social diversity?",
    options: [
      "Social diversity weakens democratic principles because conflict increases.",
      "Social diversity weakens democratic participation by ignoring the views of minorities.",
      "Democracy provides a platform for peaceful negotiation over social diversity.",
      "Democracy is inconsistent with social diversity because it needs homogeneity.",
    ],
    correct: 2,
    explanation: "Social diversity is not opposed to democracy. A democracy gives different groups a peaceful, institutional platform to voice demands, negotiate and share power, which helps accommodate diversity without violent conflict.",
  },
  {
    subject: "political-science", topic: "governance", year: 2025, difficulty: "HARD",
    text: "The Assam Movement was related to which of the following issues?",
    options: ["Linguistic problem", "Communal problem", "Regional problem", "Ethnic problem"],
    correct: 3,
    explanation: "The Assam Movement (1979-85), led by the All Assam Students' Union, was directed against illegal immigration from Bangladesh. It centred on the fear that the Assamese people would lose their cultural and political identity, so it is classified as an ethnic identity issue. It ended with the Assam Accord of 1985.",
  },
  {
    subject: "political-science", topic: "governance", year: 2025, difficulty: "MEDIUM",
    text: "During an election campaign a political party promises to provide free services and goods if it comes to power. How will you assess the credibility of that promise?",
    options: [
      "By voting on the basis of community pressure",
      "By considering only those promises that directly benefit you",
      "By supporting the party for its promises",
      "By evaluating its past performance and/or the feasibility of its promises",
    ],
    correct: 3,
    explanation: "A responsible voter judges promises by the party's record in office and by whether the promises are financially and practically achievable. Voting under community pressure or purely for personal gain does not test credibility.",
  },
  {
    subject: "political-science", topic: "governance", year: 2025, difficulty: "MEDIUM",
    text: "How do political parties enhance the effectiveness of representative democracy in India?",
    options: [
      "By ensuring that only one ideology remains dominant in the political arena",
      "By giving voters a roadmap to understand political options and cast an informed vote",
      "By discouraging voters from participating in the electoral process",
      "By limiting the number of candidates in elections to maintain stability",
    ],
    correct: 1,
    explanation: "Political parties present programmes, ideologies and candidates, and so give voters clear choices. This helps citizens understand the options and vote in an informed way, and it makes elected representatives accountable.",
  },
  {
    subject: "political-science", topic: "governance", year: 2025, difficulty: "HARD",
    text: "Which factor or feature is most likely to cause the fragmentation of political parties in a multiparty system?",
    options: [
      "Functioning of a proportional representation electoral system",
      "A unified electoral platform that attracts a wide range of voters",
      "A growing demand for representation from diverse social groups",
      "Strict party discipline that discourages disagreement among members",
    ],
    correct: 2,
    explanation: "When different social groups increasingly demand their own representation, they tend to form separate parties or break away from existing ones, and this fragments the party system. A unified platform or strict discipline works against fragmentation.",
  },
  {
    subject: "political-science", topic: "governance", year: 2025, difficulty: "MEDIUM",
    text: "According to the notification issued by the Election Commission of India in 2023, which of the following is NOT one of the six recognised national parties of India?",
    options: ["Indian National Lok Dal", "Bharatiya Janata Party", "National People's Party", "Indian National Congress"],
    correct: 0,
    explanation: "In April 2023 the Election Commission recognised six national parties: BJP, INC, AAP, BSP, CPI(M) and the National People's Party (NPP). The Indian National Lok Dal is a state party.",
  },
  {
    subject: "political-science", topic: "indian-constitution", year: 2025, difficulty: "HARD",
    text: "Under Article 3 of the Constitution, a Bill to change the boundaries of a state needs the prior recommendation of the President and is referred to the concerned state legislature for:",
    options: [
      "Conducting a referendum",
      "Giving its final consent",
      "Giving its binding approval",
      "Expressing its views within a specified time",
    ],
    correct: 3,
    explanation: "Article 3 lets Parliament form new states or alter the areas, boundaries or names of existing states. The Bill must have the President's prior recommendation and is referred to the affected state legislature only to express its views within a fixed period. Those views are not binding on Parliament.",
  },
  {
    subject: "political-science", topic: "governance", year: 2025, difficulty: "HARD",
    text: "Arrange the following steps in chronological order to show how a democratic government generally responds to the demands of different groups for greater inclusion: 1. Legal reforms to guarantee the rights of minority groups. 2. Grassroots movements demanding equality and representation. 3. Representation of diverse groups in political institutions. 4. Recognition of diversity as a political issue.",
    options: ["4 - 2 - 1 - 3", "4 - 1 - 2 - 3", "2 - 4 - 1 - 3", "2 - 4 - 3 - 1"],
    correct: 2,
    explanation: "Inclusion usually begins with grassroots movements demanding equality and representation (2). This makes diversity a recognised political issue (4). The government then brings in legal reforms to protect minority rights (1), and finally diverse groups get representation in political institutions (3). The order is 2-4-1-3.",
  },
  {
    subject: "political-science", topic: "indian-constitution", year: 2025, difficulty: "MEDIUM",
    text: "Which of the following statements about the Objectives Resolution presented in the Constituent Assembly is true?",
    options: [
      "It proposed the division of powers between the Centre and the state governments.",
      "It laid down the guiding principles of the foreign policy of independent India.",
      "It defined the principles and philosophy of the Indian Constitution.",
      "It outlined the rights and duties of citizens.",
    ],
    correct: 2,
    explanation: "Jawaharlal Nehru moved the Objectives Resolution on 13 December 1946 and the Assembly adopted it on 22 January 1947. It set out the aims and philosophy of the future Constitution (sovereignty of the people, justice, liberty, equality and fraternity) and later became the basis of the Preamble.",
  },
  {
    subject: "political-science", topic: "indian-constitution", year: 2025, difficulty: "MEDIUM",
    text: "Which of the following statements about the Indian system of judicial review is NOT correct?",
    options: [
      "High Court judges must interpret the law in a way that is consistent with the values of the Constitution.",
      "The Indian Constitution gives wide powers of judicial review because the Constitution itself is protected by the judiciary.",
      "Judicial review is concerned with only two aspects, namely legislative action and judicial decisions.",
      "The Supreme Court has the power to review the legislation of both Parliament and the state legislatures.",
    ],
    correct: 2,
    explanation: "Judicial review is not limited to two aspects. It allows the courts to examine the constitutional validity of legislative and executive actions, as well as constitutional amendments, and to strike down those that violate the Constitution. Statements 1, 2 and 4 are accurate, so the incorrect statement is 3.",
  },
  {
    subject: "political-science", topic: "governance", year: 2021, difficulty: "EASY",
    text: "Which constitutional amendment act is associated with the Panchayati Raj system in India?",
    options: ["83rd", "78th", "73rd", "88th"],
    correct: 2,
    explanation: "The 73rd Constitutional Amendment Act, 1992 (in force from April 1993) gave constitutional status to Panchayati Raj institutions by adding Part IX and the Eleventh Schedule. It followed the recommendations of the L. M. Singhvi Committee.",
  },
];

function toRow(input: PyqInput) {
  return {
    text: input.text,
    options: JSON.stringify(OPT_IDS.map((id, i) => ({ id, text: input.options[i] }))),
    correctOption: OPT_IDS[input.correct],
    explanation: input.explanation,
    difficulty: input.difficulty,
    isPYQ: true,
    pyqYear: input.year,
  };
}

async function main() {
  let created = 0;
  let updated = 0;
  for (const input of Q) {
    const subject = await prisma.subject.findUnique({ where: { slug: input.subject } });
    if (!subject) throw new Error(`Unknown subject: ${input.subject}`);
    const topic = await prisma.topic.findUnique({
      where: { subjectId_slug: { subjectId: subject.id, slug: input.topic } },
    });
    if (!topic) throw new Error(`Unknown topic: ${input.subject}/${input.topic}`);

    const data = toRow(input);
    const existing = await prisma.question.findFirst({
      where: { topicId: topic.id, text: data.text },
      select: { id: true },
    });
    if (existing) {
      await prisma.question.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      const last = await prisma.question.aggregate({
        where: { topicId: topic.id },
        _max: { order: true },
      });
      await prisma.question.create({
        data: { ...data, topicId: topic.id, order: (last._max.order ?? -1) + 1 },
      });
      created++;
    }
  }
  console.log(`SST PYQ seed complete: ${created} created, ${updated} updated (of ${Q.length}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
