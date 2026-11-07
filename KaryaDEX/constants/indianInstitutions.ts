/**
 * BunkMatKar — Comprehensive Indian Academic & Institution Directory
 *
 * Curated dataset of premier Indian Universities, Institutes of National Importance
 * (IITs, NITs, IIITs), Central & State Universities, Top Deemed/Private Institutions,
 * and Medical/Law academies with rich metadata (City, State, Acronyms, Aliases, Categories).
 *
 * Strict Rule: Feather vector icons exclusively, zero emojis, zero technical jargon.
 */

export interface IndianInstitution {
  id: string;
  name: string;
  shortName: string; // e.g., "NIT Agartala", "NITA", "IITKGP", "Jadavpur University"
  aliases: string[]; // e.g., ["NITA", "National Institute of Technology Agartala"]
  city: string;      // e.g., "Agartala"
  state: string;     // e.g., "Tripura"
  category: 'IIT' | 'NIT' | 'IIIT' | 'Central' | 'State' | 'Deemed / Private' | 'Medical / Law' | 'Other';
  programs?: string[];
  branchesByProgram?: Record<string, string[]>;
}

export type InstitutionCategory = IndianInstitution['category'];

export interface CategoryTab {
  key: 'All' | InstitutionCategory;
  label: string;
  iconName: 'grid' | 'award' | 'shield' | 'cpu' | 'compass' | 'book' | 'briefcase' | 'activity' | 'layers';
}

export const INSTITUTION_CATEGORY_TABS: CategoryTab[] = [
  { key: 'All', label: 'All Institutions', iconName: 'grid' },
  { key: 'IIT', label: 'IITs', iconName: 'award' },
  { key: 'NIT', label: 'NITs', iconName: 'shield' },
  { key: 'IIIT', label: 'IIITs', iconName: 'cpu' },
  { key: 'Central', label: 'Central Univ', iconName: 'compass' },
  { key: 'State', label: 'State Univ', iconName: 'book' },
  { key: 'Deemed / Private', label: 'Deemed & Private', iconName: 'briefcase' },
  { key: 'Medical / Law', label: 'Medical & Law', iconName: 'activity' },
];

export const INDIAN_INSTITUTIONS: IndianInstitution[] = [
  // ─── IITs (Institutes of National Importance) ───────────────────────
  {
    id: 'iit-bombay',
    name: 'Indian Institute of Technology Bombay',
    shortName: 'IIT Bombay',
    aliases: ['IITB', 'IIT Powai', 'IIT Mumbai'],
    city: 'Mumbai',
    state: 'Maharashtra',
    category: 'IIT',
  },
  {
    id: 'iit-delhi',
    name: 'Indian Institute of Technology Delhi',
    shortName: 'IIT Delhi',
    aliases: ['IITD', 'IIT Hauz Khas', 'IIT New Delhi'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'IIT',
  },
  {
    id: 'iit-madras',
    name: 'Indian Institute of Technology Madras',
    shortName: 'IIT Madras',
    aliases: ['IITM', 'IIT Chennai'],
    city: 'Chennai',
    state: 'Tamil Nadu',
    category: 'IIT',
  },
  {
    id: 'iit-kharagpur',
    name: 'Indian Institute of Technology Kharagpur',
    shortName: 'IIT Kharagpur',
    aliases: ['IITKGP', 'IIT KGP'],
    city: 'Kharagpur',
    state: 'West Bengal',
    category: 'IIT',
  },
  {
    id: 'iit-kanpur',
    name: 'Indian Institute of Technology Kanpur',
    shortName: 'IIT Kanpur',
    aliases: ['IITK', 'IIT Kanpur Kalyanpur'],
    city: 'Kanpur',
    state: 'Uttar Pradesh',
    category: 'IIT',
  },
  {
    id: 'iit-roorkee',
    name: 'Indian Institute of Technology Roorkee',
    shortName: 'IIT Roorkee',
    aliases: ['IITR', 'Thomason College of Civil Engineering'],
    city: 'Roorkee',
    state: 'Uttarakhand',
    category: 'IIT',
  },
  {
    id: 'iit-guwahati',
    name: 'Indian Institute of Technology Guwahati',
    shortName: 'IIT Guwahati',
    aliases: ['IITG', 'IIT Assam'],
    city: 'Guwahati',
    state: 'Assam',
    category: 'IIT',
  },
  {
    id: 'iit-hyderabad',
    name: 'Indian Institute of Technology Hyderabad',
    shortName: 'IIT Hyderabad',
    aliases: ['IITH', 'IIT Kandi', 'IIT Sangareddy'],
    city: 'Hyderabad',
    state: 'Telangana',
    category: 'IIT',
  },
  {
    id: 'iit-bhu',
    name: 'Indian Institute of Technology (BHU) Varanasi',
    shortName: 'IIT (BHU) Varanasi',
    aliases: ['IIT-BHU', 'IT-BHU', 'BHU Engineering'],
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    category: 'IIT',
  },
  {
    id: 'iit-ism-dhanbad',
    name: 'Indian Institute of Technology (ISM) Dhanbad',
    shortName: 'IIT (ISM) Dhanbad',
    aliases: ['IIT-ISM', 'ISM Dhanbad', 'Indian School of Mines'],
    city: 'Dhanbad',
    state: 'Jharkhand',
    category: 'IIT',
  },
  {
    id: 'iit-indore',
    name: 'Indian Institute of Technology Indore',
    shortName: 'IIT Indore',
    aliases: ['IITI', 'IIT Simrol'],
    city: 'Indore',
    state: 'Madhya Pradesh',
    category: 'IIT',
  },
  {
    id: 'iit-ropar',
    name: 'Indian Institute of Technology Ropar',
    shortName: 'IIT Ropar',
    aliases: ['IIT-RPR', 'IIT Rupnagar'],
    city: 'Rupnagar',
    state: 'Punjab',
    category: 'IIT',
  },
  {
    id: 'iit-bhubaneswar',
    name: 'Indian Institute of Technology Bhubaneswar',
    shortName: 'IIT Bhubaneswar',
    aliases: ['IIT-BBS', 'IIT Argul'],
    city: 'Bhubaneswar',
    state: 'Odisha',
    category: 'IIT',
  },
  {
    id: 'iit-gandhinagar',
    name: 'Indian Institute of Technology Gandhinagar',
    shortName: 'IIT Gandhinagar',
    aliases: ['IITGN', 'IIT Palaj'],
    city: 'Gandhinagar',
    state: 'Gujarat',
    category: 'IIT',
  },
  {
    id: 'iit-jodhpur',
    name: 'Indian Institute of Technology Jodhpur',
    shortName: 'IIT Jodhpur',
    aliases: ['IITJ', 'IIT Karwar'],
    city: 'Jodhpur',
    state: 'Rajasthan',
    category: 'IIT',
  },
  {
    id: 'iit-patna',
    name: 'Indian Institute of Technology Patna',
    shortName: 'IIT Patna',
    aliases: ['IITP', 'IIT Bihta'],
    city: 'Patna',
    state: 'Bihar',
    category: 'IIT',
  },
  {
    id: 'iit-mandi',
    name: 'Indian Institute of Technology Mandi',
    shortName: 'IIT Mandi',
    aliases: ['IITMD', 'IIT Kamand'],
    city: 'Mandi',
    state: 'Himachal Pradesh',
    category: 'IIT',
  },
  {
    id: 'iit-tirupati',
    name: 'Indian Institute of Technology Tirupati',
    shortName: 'IIT Tirupati',
    aliases: ['IIT-TP', 'IIT Yerpedu'],
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    category: 'IIT',
  },
  {
    id: 'iit-palakkad',
    name: 'Indian Institute of Technology Palakkad',
    shortName: 'IIT Palakkad',
    aliases: ['IIT-PKD', 'IIT Kanjikode'],
    city: 'Palakkad',
    state: 'Kerala',
    category: 'IIT',
  },
  {
    id: 'iit-dharwad',
    name: 'Indian Institute of Technology Dharwad',
    shortName: 'IIT Dharwad',
    aliases: ['IITDH', 'IIT Karnataka'],
    city: 'Dharwad',
    state: 'Karnataka',
    category: 'IIT',
  },
  {
    id: 'iit-bhilai',
    name: 'Indian Institute of Technology Bhilai',
    shortName: 'IIT Bhilai',
    aliases: ['IIT-BHI', 'IIT Kutelabhata'],
    city: 'Bhilai',
    state: 'Chhattisgarh',
    category: 'IIT',
  },
  {
    id: 'iit-goa',
    name: 'Indian Institute of Technology Goa',
    shortName: 'IIT Goa',
    aliases: ['IIT-GOA', 'IIT Farmagudi'],
    city: 'Ponda',
    state: 'Goa',
    category: 'IIT',
  },
  {
    id: 'iit-jammu',
    name: 'Indian Institute of Technology Jammu',
    shortName: 'IIT Jammu',
    aliases: ['IIT-JMU', 'IIT Jagti'],
    city: 'Jammu',
    state: 'Jammu and Kashmir',
    category: 'IIT',
  },

  // ─── NITs (National Institutes of Technology) ───────────────────────
  {
    id: 'nit-agartala',
    name: 'National Institute of Technology Agartala',
    shortName: 'NIT Agartala',
    aliases: ['NITA', 'Tripura Engineering College', 'TEC Agartala', 'Jirania'],
    city: 'Agartala',
    state: 'Tripura',
    category: 'NIT',
    programs: [
      'B.Tech',
      'Dual Degree (B.Tech + M.Tech)',
      'M.Tech',
      'BS-MS Dual Degree',
      'MCA',
      'MBA',
      'M.Sc',
      'Ph.D',
    ],
    branchesByProgram: {
      'B.Tech': [
        'Production Engineering',
        'Computer Science & Engineering',
        'Electronics & Communication Engineering',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Electronics & Instrumentation Engineering',
        'Biotechnology & Biochemical Engineering',
        'Mathematics & Computing',
        'Engineering Physics',
        'Metallurgical & Materials Engineering',
        'Information Technology',
      ],
      'Dual Degree (B.Tech + M.Tech)': [
        'Computer Science & Engineering',
        'Electronics & Communication Engineering',
        'Mechanical Engineering',
        'Chemical Engineering',
      ],
      'M.Tech': [
        'Manufacturing / Production Engineering',
        'Computer Science & Engineering',
        'VLSI Design',
        'Power Electronics & Drives',
        'Thermal Science & Engineering',
        'Structural Engineering',
        'Chemical Engineering',
        'Communication Engineering',
        'Transportation Engineering',
      ],
      'BS-MS Dual Degree': [
        'Physics',
        'Chemistry',
        'Mathematics & Computing',
      ],
      'MCA': [
        'Master of Computer Applications',
        'Software Engineering',
      ],
      'MBA': [
        'Finance',
        'Marketing',
        'Human Resource Management',
        'Business Analytics',
      ],
      'M.Sc': [
        'Physics',
        'Chemistry',
        'Mathematics & Computing',
      ],
      'Ph.D': [
        'Production Engineering',
        'Computer Science & Engineering',
        'Electronics & Communication Engineering',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Physics',
        'Chemistry',
        'Mathematics',
        'Humanities & Social Sciences',
      ],
    },
  },
  {
    id: 'nit-trichy',
    name: 'National Institute of Technology Tiruchirappalli',
    shortName: 'NIT Trichy',
    aliases: ['NITT', 'Regional Engineering College Trichy', 'RECT'],
    city: 'Tiruchirappalli',
    state: 'Tamil Nadu',
    category: 'NIT',
  },
  {
    id: 'nit-surathkal',
    name: 'National Institute of Technology Karnataka Surathkal',
    shortName: 'NIT Surathkal',
    aliases: ['NITK', 'KREC', 'Regional Engineering College Karnataka'],
    city: 'Mangaluru',
    state: 'Karnataka',
    category: 'NIT',
  },
  {
    id: 'nit-warangal',
    name: 'National Institute of Technology Warangal',
    shortName: 'NIT Warangal',
    aliases: ['NITW', 'RECW', 'Regional Engineering College Warangal'],
    city: 'Warangal',
    state: 'Telangana',
    category: 'NIT',
  },
  {
    id: 'nit-calicut',
    name: 'National Institute of Technology Calicut',
    shortName: 'NIT Calicut',
    aliases: ['NITC', 'CREC', 'Regional Engineering College Calicut'],
    city: 'Kozhikode',
    state: 'Kerala',
    category: 'NIT',
  },
  {
    id: 'nit-rourkela',
    name: 'National Institute of Technology Rourkela',
    shortName: 'NIT Rourkela',
    aliases: ['NITR', 'REC Rourkela'],
    city: 'Rourkela',
    state: 'Odisha',
    category: 'NIT',
  },
  {
    id: 'vnit-nagpur',
    name: 'Visvesvaraya National Institute of Technology Nagpur',
    shortName: 'VNIT Nagpur',
    aliases: ['VNIT', 'VRCE Nagpur', 'Visvesvaraya Regional College of Engineering'],
    city: 'Nagpur',
    state: 'Maharashtra',
    category: 'NIT',
  },
  {
    id: 'mnit-jaipur',
    name: 'Malaviya National Institute of Technology Jaipur',
    shortName: 'MNIT Jaipur',
    aliases: ['MNIT', 'MRCE Jaipur', 'Malaviya Regional Engineering College'],
    city: 'Jaipur',
    state: 'Rajasthan',
    category: 'NIT',
  },
  {
    id: 'mnnit-allahabad',
    name: 'Motilal Nehru National Institute of Technology Allahabad',
    shortName: 'MNNIT Allahabad',
    aliases: ['MNNIT', 'MNNIT Prayagraj', 'MNREC Allahabad'],
    city: 'Prayagraj',
    state: 'Uttar Pradesh',
    category: 'NIT',
  },
  {
    id: 'manit-bhopal',
    name: 'Maulana Azad National Institute of Technology Bhopal',
    shortName: 'MANIT Bhopal',
    aliases: ['MANIT', 'MACT Bhopal'],
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    category: 'NIT',
  },
  {
    id: 'svnit-surat',
    name: 'Sardar Vallabhbhai National Institute of Technology Surat',
    shortName: 'SVNIT Surat',
    aliases: ['SVNIT', 'SVRCET Surat'],
    city: 'Surat',
    state: 'Gujarat',
    category: 'NIT',
  },
  {
    id: 'nit-kurukshetra',
    name: 'National Institute of Technology Kurukshetra',
    shortName: 'NIT Kurukshetra',
    aliases: ['NITKKR', 'REC Kurukshetra'],
    city: 'Kurukshetra',
    state: 'Haryana',
    category: 'NIT',
  },
  {
    id: 'nit-durgapur',
    name: 'National Institute of Technology Durgapur',
    shortName: 'NIT Durgapur',
    aliases: ['NITDGP', 'REC Durgapur'],
    city: 'Durgapur',
    state: 'West Bengal',
    category: 'NIT',
  },
  {
    id: 'nit-silchar',
    name: 'National Institute of Technology Silchar',
    shortName: 'NIT Silchar',
    aliases: ['NITS', 'REC Silchar'],
    city: 'Silchar',
    state: 'Assam',
    category: 'NIT',
  },
  {
    id: 'nit-jamshedpur',
    name: 'National Institute of Technology Jamshedpur',
    shortName: 'NIT Jamshedpur',
    aliases: ['NITJSR', 'RIT Jamshedpur'],
    city: 'Jamshedpur',
    state: 'Jharkhand',
    category: 'NIT',
  },
  {
    id: 'nit-hamirpur',
    name: 'National Institute of Technology Hamirpur',
    shortName: 'NIT Hamirpur',
    aliases: ['NITH', 'REC Hamirpur'],
    city: 'Hamirpur',
    state: 'Himachal Pradesh',
    category: 'NIT',
  },
  {
    id: 'nit-patna',
    name: 'National Institute of Technology Patna',
    shortName: 'NIT Patna',
    aliases: ['NITP', 'Bihar College of Engineering', 'BCE Patna'],
    city: 'Patna',
    state: 'Bihar',
    category: 'NIT',
  },
  {
    id: 'nit-raipur',
    name: 'National Institute of Technology Raipur',
    shortName: 'NIT Raipur',
    aliases: ['NITRR', 'Government Engineering College Raipur', 'GEC Raipur'],
    city: 'Raipur',
    state: 'Chhattisgarh',
    category: 'NIT',
  },
  {
    id: 'nit-srinagar',
    name: 'National Institute of Technology Srinagar',
    shortName: 'NIT Srinagar',
    aliases: ['NITSRI', 'REC Srinagar'],
    city: 'Srinagar',
    state: 'Jammu and Kashmir',
    category: 'NIT',
  },
  {
    id: 'nit-meghalaya',
    name: 'National Institute of Technology Meghalaya',
    shortName: 'NIT Meghalaya',
    aliases: ['NITM', 'Sohra', 'Shillong'],
    city: 'Shillong',
    state: 'Meghalaya',
    category: 'NIT',
  },
  {
    id: 'nit-delhi',
    name: 'National Institute of Technology Delhi',
    shortName: 'NIT Delhi',
    aliases: ['NITD', 'NIT Narela'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'NIT',
  },
  {
    id: 'nit-goa',
    name: 'National Institute of Technology Goa',
    shortName: 'NIT Goa',
    aliases: ['NITG', 'NIT Cuncolim'],
    city: 'Cuncolim',
    state: 'Goa',
    category: 'NIT',
  },
  {
    id: 'nit-puducherry',
    name: 'National Institute of Technology Puducherry',
    shortName: 'NIT Puducherry',
    aliases: ['NITPY', 'NIT Karaikal'],
    city: 'Karaikal',
    state: 'Puducherry',
    category: 'NIT',
  },
  {
    id: 'nit-andhra-pradesh',
    name: 'National Institute of Technology Andhra Pradesh',
    shortName: 'NIT Andhra Pradesh',
    aliases: ['NITANP', 'NIT Tadepalligudem'],
    city: 'Tadepalligudem',
    state: 'Andhra Pradesh',
    category: 'NIT',
  },
  {
    id: 'iiest-shibpur',
    name: 'Indian Institute of Engineering Science and Technology Shibpur',
    shortName: 'IIEST Shibpur',
    aliases: ['IIEST', 'BESU', 'Bengal Engineering and Science University', 'BE College'],
    city: 'Howrah',
    state: 'West Bengal',
    category: 'NIT',
  },

  // ─── IIITs (Indian Institutes of Information Technology) ───────────
  {
    id: 'iiit-hyderabad',
    name: 'International Institute of Information Technology Hyderabad',
    shortName: 'IIIT Hyderabad',
    aliases: ['IIITH', 'IIIT-H', 'Gachibowli'],
    city: 'Hyderabad',
    state: 'Telangana',
    category: 'IIIT',
  },
  {
    id: 'iiit-bangalore',
    name: 'International Institute of Information Technology Bangalore',
    shortName: 'IIIT Bangalore',
    aliases: ['IIITB', 'IIIT-B', 'Electronic City'],
    city: 'Bengaluru',
    state: 'Karnataka',
    category: 'IIIT',
  },
  {
    id: 'iiit-allahabad',
    name: 'Indian Institute of Information Technology Allahabad',
    shortName: 'IIIT Allahabad',
    aliases: ['IIITA', 'IIIT-A', 'Jhalwa'],
    city: 'Prayagraj',
    state: 'Uttar Pradesh',
    category: 'IIIT',
  },
  {
    id: 'iiit-delhi',
    name: 'Indraprastha Institute of Information Technology Delhi',
    shortName: 'IIIT Delhi',
    aliases: ['IIITD', 'IIIT-D', 'Okhla'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'IIIT',
  },
  {
    id: 'iiitm-gwalior',
    name: 'Atal Bihari Vajpayee IIITM Gwalior',
    shortName: 'ABV-IIITM Gwalior',
    aliases: ['IIITM Gwalior', 'ABVIIITM'],
    city: 'Gwalior',
    state: 'Madhya Pradesh',
    category: 'IIIT',
  },
  {
    id: 'iiitdm-jabalpur',
    name: 'PDPM Indian Institute of Information Technology Design and Manufacturing Jabalpur',
    shortName: 'IIITDM Jabalpur',
    aliases: ['IIITDMJ'],
    city: 'Jabalpur',
    state: 'Madhya Pradesh',
    category: 'IIIT',
  },
  {
    id: 'iiitdm-kancheepuram',
    name: 'Indian Institute of Information Technology Design and Manufacturing Kancheepuram',
    shortName: 'IIITDM Kancheepuram',
    aliases: ['IIITDMK', 'IIIT Chennai'],
    city: 'Chennai',
    state: 'Tamil Nadu',
    category: 'IIIT',
  },
  {
    id: 'iiit-lucknow',
    name: 'Indian Institute of Information Technology Lucknow',
    shortName: 'IIIT Lucknow',
    aliases: ['IIITL', 'IIIT-L'],
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    category: 'IIIT',
  },
  {
    id: 'iiit-pune',
    name: 'Indian Institute of Information Technology Pune',
    shortName: 'IIIT Pune',
    aliases: ['IIITP'],
    city: 'Pune',
    state: 'Maharashtra',
    category: 'IIIT',
  },
  {
    id: 'iiit-sri-city',
    name: 'Indian Institute of Information Technology Sri City',
    shortName: 'IIIT Sri City',
    aliases: ['IIITS', 'IIIT Chittoor'],
    city: 'Sri City',
    state: 'Andhra Pradesh',
    category: 'IIIT',
  },

  // ─── Central Universities & Institutes ──────────────────────────────
  {
    id: 'iisc-bangalore',
    name: 'Indian Institute of Science Bangalore',
    shortName: 'IISc Bangalore',
    aliases: ['IISc', 'Tata Institute', 'IISc Bengaluru'],
    city: 'Bengaluru',
    state: 'Karnataka',
    category: 'Central',
  },
  {
    id: 'bits-pilani',
    name: 'Birla Institute of Technology and Science Pilani',
    shortName: 'BITS Pilani',
    aliases: ['BITS', 'Pilani Campus'],
    city: 'Pilani',
    state: 'Rajasthan',
    category: 'Central',
  },
  {
    id: 'bits-goa',
    name: 'BITS Pilani K. K. Birla Goa Campus',
    shortName: 'BITS Goa',
    aliases: ['BITS Pilani Goa', 'BPGC'],
    city: 'Zuarinagar',
    state: 'Goa',
    category: 'Central',
  },
  {
    id: 'bits-hyderabad',
    name: 'BITS Pilani Hyderabad Campus',
    shortName: 'BITS Hyderabad',
    aliases: ['BPHC', 'BITS Hyd'],
    city: 'Hyderabad',
    state: 'Telangana',
    category: 'Central',
  },
  {
    id: 'delhi-university',
    name: 'University of Delhi',
    shortName: 'Delhi University',
    aliases: ['DU', 'North Campus', 'South Campus', 'St Stephens', 'SRCC', 'Hindu College'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'Central',
  },
  {
    id: 'jnu-delhi',
    name: 'Jawaharlal Nehru University',
    shortName: 'JNU New Delhi',
    aliases: ['JNU'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'Central',
  },
  {
    id: 'bhu-varanasi',
    name: 'Banaras Hindu University',
    shortName: 'BHU Varanasi',
    aliases: ['BHU', 'Kashi Hindu Vishwavidyalaya'],
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    category: 'Central',
  },
  {
    id: 'jmi-delhi',
    name: 'Jamia Millia Islamia',
    shortName: 'Jamia Millia Islamia',
    aliases: ['JMI', 'Jamia'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'Central',
  },
  {
    id: 'amu-aligarh',
    name: 'Aligarh Muslim University',
    shortName: 'AMU Aligarh',
    aliases: ['AMU', 'Aligarh University'],
    city: 'Aligarh',
    state: 'Uttar Pradesh',
    category: 'Central',
  },
  {
    id: 'uoh-hyderabad',
    name: 'University of Hyderabad',
    shortName: 'University of Hyderabad',
    aliases: ['UoH', 'HCU', 'Hyderabad Central University'],
    city: 'Hyderabad',
    state: 'Telangana',
    category: 'Central',
  },
  {
    id: 'visva-bharati',
    name: 'Visva-Bharati University',
    shortName: 'Visva-Bharati',
    aliases: ['VBU', 'Santiniketan', 'Rabindranath Tagore University'],
    city: 'Santiniketan',
    state: 'West Bengal',
    category: 'Central',
  },
  {
    id: 'tezpur-university',
    name: 'Tezpur University',
    shortName: 'Tezpur University',
    aliases: ['TU', 'Napaam'],
    city: 'Tezpur',
    state: 'Assam',
    category: 'Central',
  },

  // ─── State Universities & Premier Engineering Colleges ─────────────
  {
    id: 'jadavpur-university',
    name: 'Jadavpur University',
    shortName: 'Jadavpur University',
    aliases: ['JU', 'Jadavpur', 'JU Kolkata'],
    city: 'Kolkata',
    state: 'West Bengal',
    category: 'State',
  },
  {
    id: 'anna-university',
    name: 'Anna University (College of Engineering Guindy)',
    shortName: 'Anna University',
    aliases: ['CEG', 'AU Chennai', 'Guindy'],
    city: 'Chennai',
    state: 'Tamil Nadu',
    category: 'State',
  },
  {
    id: 'coep-pune',
    name: 'COEP Technological University',
    shortName: 'COEP Pune',
    aliases: ['COEP', 'College of Engineering Pune', 'Shivajinagar'],
    city: 'Pune',
    state: 'Maharashtra',
    category: 'State',
  },
  {
    id: 'vjti-mumbai',
    name: 'Veermata Jijabai Technological Institute',
    shortName: 'VJTI Mumbai',
    aliases: ['VJTI', 'Victoria Jubilee Technical Institute', 'Matunga'],
    city: 'Mumbai',
    state: 'Maharashtra',
    category: 'State',
  },
  {
    id: 'dtu-delhi',
    name: 'Delhi Technological University',
    shortName: 'DTU Delhi',
    aliases: ['DTU', 'DCE', 'Delhi College of Engineering', 'Bawana'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'State',
  },
  {
    id: 'nsut-delhi',
    name: 'Netaji Subhas University of Technology',
    shortName: 'NSUT Delhi',
    aliases: ['NSUT', 'NSIT', 'DIT', 'Dwarka'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'State',
  },
  {
    id: 'calcutta-university',
    name: 'University of Calcutta',
    shortName: 'Calcutta University',
    aliases: ['CU', 'CU Rajabazar Science College'],
    city: 'Kolkata',
    state: 'West Bengal',
    category: 'State',
  },
  {
    id: 'mumbai-university',
    name: 'University of Mumbai',
    shortName: 'Mumbai University',
    aliases: ['MU', 'Kalina Campus', 'Fort Campus'],
    city: 'Mumbai',
    state: 'Maharashtra',
    category: 'State',
  },
  {
    id: 'sppu-pune',
    name: 'Savitribai Phule Pune University',
    shortName: 'SPPU Pune',
    aliases: ['SPPU', 'Pune University', 'Ganeshkhind'],
    city: 'Pune',
    state: 'Maharashtra',
    category: 'State',
  },
  {
    id: 'osmania-university',
    name: 'Osmania University',
    shortName: 'Osmania University',
    aliases: ['OU', 'OU Hyderabad'],
    city: 'Hyderabad',
    state: 'Telangana',
    category: 'State',
  },
  {
    id: 'andhra-university',
    name: 'Andhra University College of Engineering',
    shortName: 'Andhra University',
    aliases: ['AU', 'AUCE Visakhapatnam'],
    city: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    category: 'State',
  },
  {
    id: 'makaut-wb',
    name: 'Maulana Abul Kalam Azad University of Technology',
    shortName: 'MAKAUT West Bengal',
    aliases: ['MAKAUT', 'WBUT', 'Haringhata', 'Salt Lake'],
    city: 'Kolkata',
    state: 'West Bengal',
    category: 'State',
  },
  {
    id: 'aktu-lucknow',
    name: 'Dr. A.P.J. Abdul Kalam Technical University',
    shortName: 'AKTU Lucknow',
    aliases: ['AKTU', 'UPTU', 'Uttar Pradesh Technical University'],
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    category: 'State',
  },
  {
    id: 'vtu-belagavi',
    name: 'Visvesvaraya Technological University',
    shortName: 'VTU Belagavi',
    aliases: ['VTU', 'Machhe'],
    city: 'Belagavi',
    state: 'Karnataka',
    category: 'State',
  },
  {
    id: 'gtu-ahmedabad',
    name: 'Gujarat Technological University',
    shortName: 'GTU Ahmedabad',
    aliases: ['GTU', 'Chandkheda'],
    city: 'Ahmedabad',
    state: 'Gujarat',
    category: 'State',
  },

  // ─── Deemed & Premier Private Institutions ─────────────────────────
  {
    id: 'vit-vellore',
    name: 'Vellore Institute of Technology',
    shortName: 'VIT Vellore',
    aliases: ['VIT', 'Vellore Engineering College', 'VEC'],
    city: 'Vellore',
    state: 'Tamil Nadu',
    category: 'Deemed / Private',
  },
  {
    id: 'vit-chennai',
    name: 'VIT Chennai Campus',
    shortName: 'VIT Chennai',
    aliases: ['VITC', 'Vandalur'],
    city: 'Chennai',
    state: 'Tamil Nadu',
    category: 'Deemed / Private',
  },
  {
    id: 'manipal-mahe',
    name: 'Manipal Academy of Higher Education',
    shortName: 'MAHE Manipal',
    aliases: ['MIT Manipal', 'Manipal University'],
    city: 'Manipal',
    state: 'Karnataka',
    category: 'Deemed / Private',
  },
  {
    id: 'thapar-patiala',
    name: 'Thapar Institute of Engineering and Technology',
    shortName: 'Thapar University',
    aliases: ['TIET', 'Thapar Patiala'],
    city: 'Patiala',
    state: 'Punjab',
    category: 'Deemed / Private',
  },
  {
    id: 'srm-ktr',
    name: 'SRM Institute of Science and Technology Kattankulathur',
    shortName: 'SRM University',
    aliases: ['SRM', 'SRM KTR', 'SRM Chennai'],
    city: 'Chennai',
    state: 'Tamil Nadu',
    category: 'Deemed / Private',
  },
  {
    id: 'kiit-bhubaneswar',
    name: 'Kalinga Institute of Industrial Technology',
    shortName: 'KIIT University',
    aliases: ['KIIT', 'KIIT Bhubaneswar', 'Patia'],
    city: 'Bhubaneswar',
    state: 'Odisha',
    category: 'Deemed / Private',
  },
  {
    id: 'rvce-bangalore',
    name: 'RV College of Engineering',
    shortName: 'RVCE Bangalore',
    aliases: ['RVCE', 'RV Mysore Road'],
    city: 'Bengaluru',
    state: 'Karnataka',
    category: 'Deemed / Private',
  },
  {
    id: 'bmsce-bangalore',
    name: 'BMS College of Engineering',
    shortName: 'BMSCE Bangalore',
    aliases: ['BMSCE', 'Basavanagudi'],
    city: 'Bengaluru',
    state: 'Karnataka',
    category: 'Deemed / Private',
  },
  {
    id: 'msrit-bangalore',
    name: 'Ramaiah Institute of Technology',
    shortName: 'MSRIT Bangalore',
    aliases: ['MSRIT', 'Ramaiah', 'Mathikere'],
    city: 'Bengaluru',
    state: 'Karnataka',
    category: 'Deemed / Private',
  },
  {
    id: 'pes-university',
    name: 'PES University',
    shortName: 'PES University',
    aliases: ['PESU', 'PESIT', 'Ring Road Campus'],
    city: 'Bengaluru',
    state: 'Karnataka',
    category: 'Deemed / Private',
  },
  {
    id: 'psg-tech',
    name: 'PSG College of Technology',
    shortName: 'PSG Tech',
    aliases: ['PSG', 'Peelamedu'],
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    category: 'Deemed / Private',
  },
  {
    id: 'sastra-university',
    name: 'SASTRA Deemed University',
    shortName: 'SASTRA Thanjavur',
    aliases: ['SASTRA', 'Shanmugha'],
    city: 'Thanjavur',
    state: 'Tamil Nadu',
    category: 'Deemed / Private',
  },
  {
    id: 'heritage-kolkata',
    name: 'Heritage Institute of Technology',
    shortName: 'HIT Kolkata',
    aliases: ['HIT', 'Heritage Anandapur'],
    city: 'Kolkata',
    state: 'West Bengal',
    category: 'Deemed / Private',
  },
  {
    id: 'iem-kolkata',
    name: 'Institute of Engineering and Management',
    shortName: 'IEM Kolkata',
    aliases: ['IEM', 'IEM Salt Lake', 'Sector V'],
    city: 'Kolkata',
    state: 'West Bengal',
    category: 'Deemed / Private',
  },
  {
    id: 'tmsl-kolkata',
    name: 'Techno Main Salt Lake',
    shortName: 'TMSL Kolkata',
    aliases: ['TMSL', 'Techno India Salt Lake'],
    city: 'Kolkata',
    state: 'West Bengal',
    category: 'Deemed / Private',
  },
  {
    id: 'amity-noida',
    name: 'Amity University Noida',
    shortName: 'Amity Noida',
    aliases: ['Amity', 'Sector 125'],
    city: 'Noida',
    state: 'Uttar Pradesh',
    category: 'Deemed / Private',
  },
  {
    id: 'snu-noida',
    name: 'Shiv Nadar University',
    shortName: 'Shiv Nadar University',
    aliases: ['SNU', 'Dadri'],
    city: 'Greater Noida',
    state: 'Uttar Pradesh',
    category: 'Deemed / Private',
  },
  {
    id: 'ashoka-university',
    name: 'Ashoka University',
    shortName: 'Ashoka University',
    aliases: ['Ashoka', 'Sonipat'],
    city: 'Sonipat',
    state: 'Haryana',
    category: 'Deemed / Private',
  },
  {
    id: 'nmims-mumbai',
    name: 'NMIMS Deemed to be University',
    shortName: 'NMIMS Mumbai',
    aliases: ['NMIMS', 'Narsee Monjee', 'MPSTME', 'Vile Parle'],
    city: 'Mumbai',
    state: 'Maharashtra',
    category: 'Deemed / Private',
  },
  {
    id: 'symbiosis-pune',
    name: 'Symbiosis International University',
    shortName: 'Symbiosis Pune',
    aliases: ['SIU', 'SIT Pune', 'Lavale'],
    city: 'Pune',
    state: 'Maharashtra',
    category: 'Deemed / Private',
  },
  {
    id: 'mit-wpu-pune',
    name: 'MIT World Peace University',
    shortName: 'MIT-WPU Pune',
    aliases: ['MIT-WPU', 'MIT Kothrud'],
    city: 'Pune',
    state: 'Maharashtra',
    category: 'Deemed / Private',
  },
  {
    id: 'daiict-gandhinagar',
    name: 'Dhirubhai Ambani Institute of Information and Communication Technology',
    shortName: 'DA-IICT Gandhinagar',
    aliases: ['DAIICT', 'DA-IICT', 'Dhirubhai Ambani Institute'],
    city: 'Gandhinagar',
    state: 'Gujarat',
    category: 'Deemed / Private',
  },
  {
    id: 'nirma-ahmedabad',
    name: 'Nirma University',
    shortName: 'Nirma University',
    aliases: ['Nirma', 'Institute of Technology Nirma'],
    city: 'Ahmedabad',
    state: 'Gujarat',
    category: 'Deemed / Private',
  },
  {
    id: 'lpu-punjab',
    name: 'Lovely Professional University',
    shortName: 'LPU Punjab',
    aliases: ['LPU', 'Phagwara', 'Jalandhar'],
    city: 'Phagwara',
    state: 'Punjab',
    category: 'Deemed / Private',
  },
  {
    id: 'cu-punjab',
    name: 'Chandigarh University',
    shortName: 'Chandigarh University',
    aliases: ['CU Mohali', 'Gharuan'],
    city: 'Mohali',
    state: 'Punjab',
    category: 'Deemed / Private',
  },

  // ─── Medical, Law & Specialized Institutions ────────────────────────
  {
    id: 'aiims-delhi',
    name: 'All India Institute of Medical Sciences New Delhi',
    shortName: 'AIIMS New Delhi',
    aliases: ['AIIMS', 'AIIMS Delhi', 'Ansari Nagar'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'Medical / Law',
  },
  {
    id: 'aiims-bhubaneswar',
    name: 'All India Institute of Medical Sciences Bhubaneswar',
    shortName: 'AIIMS Bhubaneswar',
    aliases: ['AIIMS BBS', 'Sijua'],
    city: 'Bhubaneswar',
    state: 'Odisha',
    category: 'Medical / Law',
  },
  {
    id: 'aiims-rishikesh',
    name: 'All India Institute of Medical Sciences Rishikesh',
    shortName: 'AIIMS Rishikesh',
    aliases: ['AIIMS Virbhadra'],
    city: 'Rishikesh',
    state: 'Uttarakhand',
    category: 'Medical / Law',
  },
  {
    id: 'cmc-vellore',
    name: 'Christian Medical College Vellore',
    shortName: 'CMC Vellore',
    aliases: ['CMC', 'Ida Scudder'],
    city: 'Vellore',
    state: 'Tamil Nadu',
    category: 'Medical / Law',
  },
  {
    id: 'pgimer-chandigarh',
    name: 'Postgraduate Institute of Medical Education and Research',
    shortName: 'PGIMER Chandigarh',
    aliases: ['PGI', 'PGIMER'],
    city: 'Chandigarh',
    state: 'Punjab',
    category: 'Medical / Law',
  },
  {
    id: 'jipmer-puducherry',
    name: 'Jawaharlal Institute of Postgraduate Medical Education and Research',
    shortName: 'JIPMER Puducherry',
    aliases: ['JIPMER', 'Dhanvantari Nagar'],
    city: 'Puducherry',
    state: 'Puducherry',
    category: 'Medical / Law',
  },
  {
    id: 'nlsiu-bangalore',
    name: 'National Law School of India University',
    shortName: 'NLSIU Bengaluru',
    aliases: ['NLSIU', 'NLS Bangalore', 'Nagarbhavi'],
    city: 'Bengaluru',
    state: 'Karnataka',
    category: 'Medical / Law',
  },
  {
    id: 'nalsar-hyderabad',
    name: 'NALSAR University of Law',
    shortName: 'NALSAR Hyderabad',
    aliases: ['NALSAR', 'Shamirpet'],
    city: 'Hyderabad',
    state: 'Telangana',
    category: 'Medical / Law',
  },
  {
    id: 'nujs-kolkata',
    name: 'West Bengal National University of Juridical Sciences',
    shortName: 'WBNUJS Kolkata',
    aliases: ['NUJS', 'NUJS Salt Lake'],
    city: 'Kolkata',
    state: 'West Bengal',
    category: 'Medical / Law',
  },
  {
    id: 'nlud-delhi',
    name: 'National Law University Delhi',
    shortName: 'NLU Delhi',
    aliases: ['NLUD', 'Sector 14 Dwarka'],
    city: 'New Delhi',
    state: 'Delhi',
    category: 'Medical / Law',
  },
];

/**
 * Filter & search institutions with high-precision fuzzy/acronym match
 */
export function searchInstitutions(
  query: string,
  categoryFilter?: 'All' | InstitutionCategory
): IndianInstitution[] {
  const q = query.trim().toLowerCase();
  const cleanQ = q.replace(/[^a-z0-9]/g, '');

  return INDIAN_INSTITUTIONS.filter((inst) => {
    // 1. Category Filter
    if (categoryFilter && categoryFilter !== 'All' && inst.category !== categoryFilter) {
      return false;
    }

    if (!q) return true;

    // Direct text inclusions
    if (inst.name.toLowerCase().includes(q)) return true;
    if (inst.shortName.toLowerCase().includes(q)) return true;
    if (inst.city.toLowerCase().includes(q)) return true;
    if (inst.state.toLowerCase().includes(q)) return true;

    // Aliases check
    for (const alias of inst.aliases) {
      if (alias.toLowerCase().includes(q)) return true;
      if (cleanQ && alias.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanQ)) {
        return true;
      }
    }

    // Acronym / Initials matching (e.g. "NITA" -> NIT Agartala)
    const nameInitials = inst.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toLowerCase();
    if (cleanQ && nameInitials.includes(cleanQ)) return true;

    return false;
  });
}

// ─── Common Degrees & Programs ──────────────────────────────────────────
export interface AcademicDegreeOption {
  id: string;
  name: string;
  shortCode: string;
  category: 'Engineering' | 'Sciences' | 'Commerce & Mgmt' | 'Arts & Law' | 'Medical' | 'Other';
  defaultTotalSemesters: number;
}

export const ACADEMIC_PROGRAMS: AcademicDegreeOption[] = [
  { id: 'btech', name: 'B.Tech / B.E. (Bachelor of Technology)', shortCode: 'B.Tech', category: 'Engineering', defaultTotalSemesters: 8 },
  { id: 'dual-btech', name: 'Dual Degree (B.Tech + M.Tech)', shortCode: 'Dual B.Tech', category: 'Engineering', defaultTotalSemesters: 10 },
  { id: 'bsc', name: 'B.Sc / B.S. (Bachelor of Science)', shortCode: 'B.Sc', category: 'Sciences', defaultTotalSemesters: 6 },
  { id: 'bca', name: 'BCA (Bachelor of Computer Applications)', shortCode: 'BCA', category: 'Sciences', defaultTotalSemesters: 6 },
  { id: 'bcom', name: 'B.Com / B.Com (Honours)', shortCode: 'B.Com', category: 'Commerce & Mgmt', defaultTotalSemesters: 6 },
  { id: 'bba', name: 'BBA / BMS (Business Administration)', shortCode: 'BBA', category: 'Commerce & Mgmt', defaultTotalSemesters: 6 },
  { id: 'ba', name: 'B.A. / B.A. (Honours)', shortCode: 'B.A.', category: 'Arts & Law', defaultTotalSemesters: 6 },
  { id: 'law-5yr', name: 'B.A. LL.B / BBA LL.B (Integrated Law)', shortCode: 'LL.B (5Y)', category: 'Arts & Law', defaultTotalSemesters: 10 },
  { id: 'mbbs', name: 'MBBS / BDS (Medical Sciences)', shortCode: 'MBBS', category: 'Medical', defaultTotalSemesters: 9 },
  { id: 'bpharm', name: 'B.Pharm (Bachelor of Pharmacy)', shortCode: 'B.Pharm', category: 'Medical', defaultTotalSemesters: 8 },
  { id: 'barch', name: 'B.Arch (Bachelor of Architecture)', shortCode: 'B.Arch', category: 'Engineering', defaultTotalSemesters: 10 },
  { id: 'mtech', name: 'M.Tech / M.E. (Master of Technology)', shortCode: 'M.Tech', category: 'Engineering', defaultTotalSemesters: 4 },
  { id: 'mca', name: 'MCA (Master of Computer Applications)', shortCode: 'MCA', category: 'Sciences', defaultTotalSemesters: 4 },
  { id: 'mba', name: 'MBA / PGDM (Business Administration)', shortCode: 'MBA', category: 'Commerce & Mgmt', defaultTotalSemesters: 4 },
  { id: 'other', name: 'Other Academic Degree', shortCode: 'Other', category: 'Other', defaultTotalSemesters: 8 },
];

// ─── Common Branches / Disciplines ─────────────────────────────────────
export const COMMON_BRANCHES: string[] = [
  'Computer Science & Engineering',
  'Artificial Intelligence & Machine Learning',
  'Data Science & Analytics',
  'Information Technology',
  'Electronics & Communication Engineering',
  'Electrical & Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Biotechnology & Biochemical Engineering',
  'Aerospace & Aeronautical Engineering',
  'Metallurgical & Materials Engineering',
  'Production & Industrial Engineering',
  'Mathematics & Computing',
  'Engineering Physics',
  'Finance & Accounting',
  'Business Analytics',
  'Economics & Political Science',
];

// ─── College & Category Academic Offerings Mapping ─────────────────────

export interface CategoryAcademicOffering {
  programs: string[];
  branchesByProgram: Record<string, string[]>;
}

export const CATEGORY_ACADEMIC_OFFERINGS: Record<InstitutionCategory, CategoryAcademicOffering> = {
  NIT: {
    programs: [
      'B.Tech',
      'Dual Degree (B.Tech + M.Tech)',
      'M.Tech',
      'BS-MS Dual Degree',
      'MCA',
      'MBA',
      'M.Sc',
      'Ph.D',
    ],
    branchesByProgram: {
      'B.Tech': [
        'Production Engineering',
        'Computer Science & Engineering',
        'Electronics & Communication Engineering',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Electronics & Instrumentation Engineering',
        'Biotechnology & Biochemical Engineering',
        'Mathematics & Computing',
        'Engineering Physics',
        'Metallurgical & Materials Engineering',
        'Information Technology',
      ],
      'Dual Degree (B.Tech + M.Tech)': [
        'Computer Science & Engineering',
        'Electronics & Communication Engineering',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Chemical Engineering',
      ],
      'M.Tech': [
        'Manufacturing / Production Engineering',
        'Computer Science & Engineering',
        'VLSI Design & Embedded Systems',
        'Power Systems & Electrical Drives',
        'Thermal Engineering',
        'Structural Engineering',
        'Chemical Engineering',
        'Communication Systems',
        'Environmental Engineering',
        'Geotechnical Engineering',
      ],
      'BS-MS Dual Degree': [
        'Physics',
        'Chemistry',
        'Mathematics & Computing',
        'Applied Physics',
      ],
      'MCA': [
        'Master of Computer Applications',
        'Software Engineering',
        'Cloud & Data Analytics',
      ],
      'MBA': [
        'Finance & Banking',
        'Marketing Management',
        'Operations & Supply Chain',
        'Human Resource Management',
        'Business Analytics',
      ],
      'M.Sc': [
        'Physics',
        'Chemistry',
        'Applied Mathematics',
        'Biotechnology',
      ],
      'Ph.D': [
        'Production Engineering',
        'Computer Science & Engineering',
        'Electronics & Communication Engineering',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Physics',
        'Chemistry',
        'Mathematics',
        'Humanities & Social Sciences',
      ],
    },
  },

  IIT: {
    programs: [
      'B.Tech',
      'B.S.',
      'Dual Degree (B.Tech + M.Tech)',
      'M.Tech',
      'M.Sc',
      'Ph.D',
    ],
    branchesByProgram: {
      'B.Tech': [
        'Computer Science & Engineering',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Aerospace Engineering',
        'Metallurgical Engineering & Materials Science',
        'Engineering Physics',
        'Mathematics & Computing',
        'Biotechnology & Biochemical Engineering',
        'Production & Industrial Engineering',
        'Ocean Engineering & Naval Architecture',
        'Energy Science & Engineering',
        'Mining Engineering',
      ],
      'B.S.': [
        'Mathematics & Computing',
        'Physics',
        'Chemistry',
        'Economics',
        'Earth Sciences',
      ],
      'Dual Degree (B.Tech + M.Tech)': [
        'Computer Science & Engineering',
        'Electrical Engineering',
        'Aerospace Engineering',
        'Mechanical Engineering',
        'Biochemical Engineering',
        'Data Science & Artificial Intelligence',
      ],
      'M.Tech': [
        'Artificial Intelligence & Data Science',
        'Computer Science & Engineering',
        'VLSI Design',
        'Control & Automation',
        'Thermal & Fluids Engineering',
        'Structural Engineering',
        'Robotics & Autonomous Systems',
        'Materials Engineering',
        'Biomedical Engineering',
      ],
      'M.Sc': [
        'Physics',
        'Chemistry',
        'Applied Mathematics',
        'Statistics',
        'Geology & Geophysics',
        'Biotechnology',
      ],
      'Ph.D': [
        'Computer Science & Engineering',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Chemical Engineering',
        'Physics',
        'Chemistry',
        'Mathematics',
        'Biosciences & Bioengineering',
      ],
    },
  },

  IIIT: {
    programs: [
      'B.Tech',
      'Dual Degree (B.Tech + M.Tech)',
      'M.Tech',
      'Ph.D',
    ],
    branchesByProgram: {
      'B.Tech': [
        'Computer Science & Engineering',
        'Electronics & Communication Engineering',
        'Information Technology',
        'Artificial Intelligence & Data Science',
        'Computer Science & AI',
        'Computer Science & Business Systems',
        'Computer Science & Biosciences',
      ],
      'Dual Degree (B.Tech + M.Tech)': [
        'Computer Science & Engineering',
        'Electronics & Communication Engineering',
        'AI & Machine Learning',
        'Computational Linguistics',
      ],
      'M.Tech': [
        'Computer Science & Engineering',
        'AI & Machine Learning',
        'Cyber Security',
        'VLSI & Embedded Systems',
        'Data Engineering',
        'Robotics',
      ],
      'Ph.D': [
        'Computer Science & Engineering',
        'Electronics & Communication Engineering',
        'Data Science & AI',
        'Information Systems',
      ],
    },
  },

  Central: {
    programs: [
      'B.Tech',
      'B.Sc',
      'BCA',
      'B.Com',
      'BBA',
      'B.A.',
      'M.Tech',
      'MCA',
      'MBA',
      'M.Sc',
      'M.A.',
      'Ph.D',
    ],
    branchesByProgram: {
      'B.Tech': [
        'Computer Science & Engineering',
        'Information Technology',
        'Electronics & Communication Engineering',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Biotechnology',
      ],
      'B.Sc': [
        'Computer Science',
        'Physics',
        'Chemistry',
        'Mathematics',
        'Statistics',
        'Biotechnology',
        'Botany',
        'Zoology',
        'Geology',
      ],
      'BCA': [
        'Computer Applications',
        'Cloud Computing',
        'Data Analytics',
        'Software Development',
      ],
      'B.Com': [
        'Accounting & Finance',
        'Banking & Insurance',
        'Financial Markets',
        'General Commerce',
        'Taxation',
      ],
      'BBA': [
        'General Management',
        'Marketing',
        'Finance',
        'Human Resources',
        'International Business',
      ],
      'B.A.': [
        'English Literature',
        'Economics',
        'Political Science',
        'History',
        'Psychology',
        'Sociology',
        'Journalism & Mass Communication',
      ],
      'M.Tech': [
        'Computer Science & Engineering',
        'Information Technology',
        'Electronics',
        'Power Engineering',
        'Biotechnology',
      ],
      'MCA': [
        'Computer Applications',
        'Data Science',
        'Software Engineering',
      ],
      'MBA': [
        'Finance',
        'Marketing',
        'Operations',
        'Human Resources',
        'Business Analytics',
      ],
      'M.Sc': [
        'Physics',
        'Chemistry',
        'Mathematics',
        'Computer Science',
        'Biotechnology',
        'Statistics',
      ],
      'M.A.': [
        'Economics',
        'English',
        'Political Science',
        'Sociology',
        'History',
        'Psychology',
      ],
      'Ph.D': [
        'Sciences',
        'Engineering',
        'Humanities & Social Sciences',
        'Commerce & Management',
      ],
    },
  },

  State: {
    programs: [
      'B.Tech',
      'B.E.',
      'B.Sc',
      'BCA',
      'B.Com',
      'BBA',
      'B.A.',
      'M.Tech',
      'MCA',
      'MBA',
      'M.Sc',
      'M.A.',
      'Ph.D',
    ],
    branchesByProgram: {
      'B.Tech': [
        'Computer Science & Engineering',
        'Information Technology',
        'Electronics & Communication Engineering',
        'Electrical & Electronics Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Production Engineering',
        'Instrumentation Engineering',
        'Automobile Engineering',
        'Biotechnology',
      ],
      'B.E.': [
        'Computer Science & Engineering',
        'Information Technology',
        'Electronics & Telecommunication',
        'Electrical Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Metallurgical Engineering',
        'Instrumentation Engineering',
      ],
      'B.Sc': [
        'Computer Science',
        'Physics',
        'Chemistry',
        'Mathematics',
        'Statistics',
        'Microbiology',
        'Biotechnology',
        'Botany',
        'Zoology',
      ],
      'BCA': [
        'Computer Applications',
        'Data Science',
        'Web Development',
        'Cyber Security',
      ],
      'B.Com': [
        'General Commerce',
        'Accounting & Finance',
        'Banking & Insurance',
        'Corporate Secretaryship',
      ],
      'BBA': [
        'General Management',
        'Marketing',
        'Finance',
        'Human Resources',
        'Entrepreneurship',
      ],
      'B.A.': [
        'English Literature',
        'Economics',
        'Political Science',
        'History',
        'Bengali',
        'Hindi',
        'Philosophy',
        'Sociology',
      ],
      'M.Tech': [
        'Computer Science & Engineering',
        'VLSI Design',
        'Structural Engineering',
        'Power Systems',
        'Thermal Engineering',
        'Production Engineering',
      ],
      'MCA': [
        'Computer Applications',
        'Software Systems',
      ],
      'MBA': [
        'Finance',
        'Marketing',
        'Operations',
        'Human Resources',
      ],
      'M.Sc': [
        'Computer Science',
        'Mathematics',
        'Physics',
        'Chemistry',
        'Applied Geology',
        'Biotechnology',
      ],
      'M.A.': [
        'English',
        'Economics',
        'History',
        'Political Science',
        'International Relations',
      ],
      'Ph.D': [
        'Engineering',
        'Sciences',
        'Arts & Humanities',
        'Commerce',
      ],
    },
  },

  'Deemed / Private': {
    programs: [
      'B.Tech',
      'B.Sc',
      'BCA',
      'B.Com',
      'BBA',
      'B.A.',
      'M.Tech',
      'MCA',
      'MBA',
      'M.Sc',
      'Ph.D',
    ],
    branchesByProgram: {
      'B.Tech': [
        'Computer Science & Engineering',
        'Artificial Intelligence & Machine Learning',
        'Data Science',
        'Cyber Security',
        'Information Technology',
        'Electronics & Communication Engineering',
        'Electrical & Electronics Engineering',
        'Mechanical Engineering',
        'Civil Engineering',
        'Biotechnology',
        'Aerospace Engineering',
        'Robotics & Automation',
      ],
      'B.Sc': [
        'Computer Science',
        'Data Analytics',
        'Physics',
        'Chemistry',
        'Mathematics',
        'Economics & Finance',
      ],
      'BCA': [
        'Computer Applications',
        'Full Stack Development',
        'Cloud Computing',
        'AI & Data Analytics',
      ],
      'B.Com': [
        'Accounting & Finance',
        'Honours with ACCA',
        'Banking & Fintech',
        'International Accounting',
      ],
      'BBA': [
        'General Management',
        'Business Analytics',
        'Digital Marketing',
        'Fintech',
        'Global Business',
      ],
      'B.A.': [
        'Liberal Arts',
        'Psychology',
        'Economics',
        'Journalism & Media Studies',
        'English',
      ],
      'M.Tech': [
        'Computer Science & Engineering',
        'AI & Data Science',
        'VLSI & Embedded Systems',
        'Robotics',
        'Structural Engineering',
      ],
      'MCA': [
        'Computer Applications',
        'Cloud Technologies',
        'AI & Machine Learning',
      ],
      'MBA': [
        'Finance',
        'Marketing',
        'Business Analytics',
        'Supply Chain Management',
        'Human Resources',
        'Health Care Management',
      ],
      'M.Sc': [
        'Data Science',
        'Applied Mathematics',
        'Physics',
        'Chemistry',
        'Economics',
      ],
      'Ph.D': [
        'Computer Science & Engineering',
        'Management',
        'Sciences',
        'Interdisciplinary Studies',
      ],
    },
  },

  'Medical / Law': {
    programs: [
      'MBBS',
      'BDS',
      'B.Pharm',
      'B.A. LL.B',
      'BBA LL.B',
      'LL.M',
      'MD / MS',
      'Ph.D',
    ],
    branchesByProgram: {
      'MBBS': [
        'General Medicine & Surgery',
        'Medicine & Surgery (General)',
        'Pre-Clinical & Clinical Medicine',
      ],
      'BDS': [
        'Dental Surgery',
        'Oral & Maxillofacial Pathology',
        'Orthodontics',
        'Periodontics',
        'Prosthodontics',
      ],
      'B.Pharm': [
        'Pharmaceutics',
        'Pharmaceutical Chemistry',
        'Pharmacology',
        'Pharmacognosy',
      ],
      'B.A. LL.B': [
        'Constitutional Law',
        'Corporate & Commercial Law',
        'Criminal Law',
        'Intellectual Property Rights',
        'International Trade Law',
        'Cyber Law',
      ],
      'BBA LL.B': [
        'Corporate Law & Governance',
        'Mergers & Acquisitions',
        'Commercial Arbitration',
        'Banking & Finance Law',
      ],
      'LL.M': [
        'Corporate & Commercial Law',
        'Constitutional & Administrative Law',
        'Criminal Law',
        'Intellectual Property Law',
        'Human Rights Law',
      ],
      'MD / MS': [
        'General Medicine',
        'General Surgery',
        'Pediatrics',
        'Radiology',
        'Anesthesiology',
        'Obstetrics & Gynecology',
        'Dermatology',
        'Orthopedics',
        'Ophthalmology',
        'Psychiatry',
      ],
      'Ph.D': [
        'Medical Sciences',
        'Pharmaceutical Sciences',
        'Legal Studies & Jurisprudence',
      ],
    },
  },

  Other: {
    programs: [
      'B.Tech',
      'B.E.',
      'B.Sc',
      'BCA',
      'B.Com',
      'BBA',
      'B.A.',
      'M.Tech',
      'MCA',
      'MBA',
      'M.Sc',
      'M.A.',
      'Other',
    ],
    branchesByProgram: {
      'B.Tech': COMMON_BRANCHES,
      'B.E.': COMMON_BRANCHES,
      'B.Sc': ['Computer Science', 'Physics', 'Chemistry', 'Mathematics', 'Statistics', 'Biotechnology'],
      'BCA': ['Computer Applications', 'Software Development', 'Data Analytics'],
      'B.Com': ['Accounting & Finance', 'Banking & Insurance', 'General Commerce'],
      'BBA': ['General Management', 'Marketing', 'Finance', 'Human Resources'],
      'B.A.': ['English Literature', 'Economics', 'Political Science', 'History'],
      'M.Tech': ['Computer Science & Engineering', 'VLSI', 'Power Systems', 'Thermal Engineering'],
      'MCA': ['Computer Applications', 'Software Engineering'],
      'MBA': ['Finance', 'Marketing', 'Operations', 'Human Resources'],
      'M.Sc': ['Mathematics', 'Physics', 'Chemistry', 'Computer Science'],
      'M.A.': ['English', 'Economics', 'Political Science'],
      'Other': COMMON_BRANCHES,
    },
  },
};

/**
 * Returns the degrees / programs offered by a specific Indian Institution.
 * Scoped to the institution's explicit offerings or category offerings.
 */
export function getProgramsForInstitution(institution?: IndianInstitution | null): string[] {
  if (!institution) {
    return [
      'B.Tech / B.E.',
      'B.Tech',
      'Dual Degree (B.Tech + M.Tech)',
      'B.Sc',
      'BCA',
      'B.Com',
      'BBA',
      'B.A.',
      'M.Tech',
      'MCA',
      'MBA',
      'M.Sc',
      'MBBS',
      'Law',
      'Other',
    ];
  }

  if (institution.programs && institution.programs.length > 0) {
    return institution.programs;
  }

  const categoryOffering = CATEGORY_ACADEMIC_OFFERINGS[institution.category];
  if (categoryOffering && categoryOffering.programs.length > 0) {
    return categoryOffering.programs;
  }

  return ['B.Tech / B.E.', 'B.Sc', 'BCA', 'B.Com', 'BBA', 'B.A.', 'M.Tech', 'MCA', 'MBA', 'Other'];
}

/**
 * Normalizes program name to match branches dictionary keys
 * (e.g. "B.Tech / B.E." -> "B.Tech", "Dual Degree" -> "Dual Degree (B.Tech + M.Tech)")
 */
function normalizeProgramKey(programName: string, availableKeys: string[]): string {
  const trimmed = programName.trim();
  if (availableKeys.includes(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  for (const k of availableKeys) {
    if (k.toLowerCase() === lower) return k;
  }

  if (lower.includes('b.tech') || lower.includes('btech')) {
    const match = availableKeys.find((k) => k.toLowerCase().includes('b.tech'));
    if (match) return match;
  }

  if (lower.includes('dual')) {
    const match = availableKeys.find((k) => k.toLowerCase().includes('dual'));
    if (match) return match;
  }

  if (lower.includes('b.e.') || lower.includes('be')) {
    const match = availableKeys.find((k) => k.toLowerCase().includes('b.e.'));
    if (match) return match;
  }

  if (lower.includes('b.sc') || lower.includes('bsc')) {
    const match = availableKeys.find((k) => k.toLowerCase().includes('b.sc'));
    if (match) return match;
  }

  if (lower.includes('law') || lower.includes('ll.b')) {
    const match = availableKeys.find((k) => k.toLowerCase().includes('ll.b'));
    if (match) return match;
  }

  return availableKeys[0] || 'B.Tech';
}

/**
 * Returns the branches / majors / specializations offered by an institution for a specific program.
 */
export function getBranchesForInstitutionAndProgram(
  institution: IndianInstitution | null | undefined,
  programName: string
): string[] {
  if (!programName) return COMMON_BRANCHES;

  if (institution && institution.branchesByProgram) {
    const keys = Object.keys(institution.branchesByProgram);
    const key = normalizeProgramKey(programName, keys);
    if (institution.branchesByProgram[key]) {
      return institution.branchesByProgram[key];
    }
  }

  if (institution && institution.category) {
    const cat = CATEGORY_ACADEMIC_OFFERINGS[institution.category];
    if (cat && cat.branchesByProgram) {
      const keys = Object.keys(cat.branchesByProgram);
      const key = normalizeProgramKey(programName, keys);
      if (cat.branchesByProgram[key]) {
        return cat.branchesByProgram[key];
      }
    }
  }

  // Fallback category search across all categories
  for (const catKey of Object.keys(CATEGORY_ACADEMIC_OFFERINGS) as InstitutionCategory[]) {
    const offering = CATEGORY_ACADEMIC_OFFERINGS[catKey];
    const keys = Object.keys(offering.branchesByProgram);
    const key = normalizeProgramKey(programName, keys);
    if (offering.branchesByProgram[key]) {
      return offering.branchesByProgram[key];
    }
  }

  return COMMON_BRANCHES;
}

// ─── Attendance Policy Benchmarks matching 2.png ───────────────────────
export interface AttendanceBenchmark {
  percent: number;
  title: string;
  tagline: string;
  safetyCushion: string;
  debarRisk: 'Zero' | 'Minimal' | 'Moderate' | 'Critical';
  color: string;
  glow: string;
  iconName: 'shield' | 'check-circle' | 'award' | 'sliders';
  description: string;
}

export const ATTENDANCE_BENCHMARKS: AttendanceBenchmark[] = [
  {
    percent: 75,
    title: 'Standard Statutory Cutoff',
    tagline: 'MANDATORY UNIVERSITY CRITERION',
    safetyCushion: '+0.0% Baseline',
    debarRisk: 'Zero',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.35)',
    iconName: 'shield',
    description: 'Exact university examination threshold. Zero tolerance for unexcused attendance slips.',
  },
  {
    percent: 80,
    title: 'Safety Cushion Harbor',
    tagline: 'RECOMMENDED FOR PRACTICALS & LABS',
    safetyCushion: '+5.0% Above Target',
    debarRisk: 'Zero',
    color: '#06B6D4',
    glow: 'rgba(6, 182, 212, 0.35)',
    iconName: 'check-circle',
    description: 'Provides a reliable buffer against surprise quizzes, minor illnesses, or unannounced cancellations.',
  },
  {
    percent: 85,
    title: 'Elite Academic Shield',
    tagline: 'HONOR ROLL & PLACEMENT SHIELD',
    safetyCushion: '+10.0% Above Target',
    debarRisk: 'Zero',
    color: '#818CF8',
    glow: 'rgba(129, 140, 248, 0.35)',
    iconName: 'award',
    description: 'Maintains pristine clearance for campus recruitment, scholarship eligibility, and dean endorsements.',
  },
];
