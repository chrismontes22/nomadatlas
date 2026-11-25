// Curated list of popular remote-work hubs.
// Each entry: [display name, ISO 3166-1 alpha-2, GeoNames lookup name (optional), alternative names (optional)]
// Coordinates, population, elevation and time zone are resolved from GeoNames (CC BY 4.0) at build time.
export const CITY_LIST = [
  // Southern & Western Europe
  ["Lisbon", "PT"], ["Porto", "PT"], ["Funchal", "PT", null, "Madeira"], ["Lagos", "PT", null, "Algarve"], ["Ericeira", "PT"],
  ["Barcelona", "ES"], ["Madrid", "ES"], ["Valencia", "ES"], ["Málaga", "ES", "Malaga"], ["Seville", "ES", "Sevilla"],
  ["Las Palmas de Gran Canaria", "ES", null, "Gran Canaria"], ["Santa Cruz de Tenerife", "ES", null, "Tenerife"], ["Alicante", "ES"], ["Palma", "ES", null, "Mallorca"],
  ["Paris", "FR"], ["Nice", "FR"], ["Marseille", "FR"], ["Lyon", "FR"],
  ["Rome", "IT"], ["Milan", "IT"], ["Florence", "IT"], ["Naples", "IT"], ["Bologna", "IT"], ["Palermo", "IT"],
  ["Athens", "GR"], ["Thessaloniki", "GR"], ["Chania", "GR", null, "Crete"],
  ["Valletta", "MT", null, "Malta"], ["Limassol", "CY"],
  // Northern & Central Europe
  ["Berlin", "DE"], ["Munich", "DE"], ["Hamburg", "DE"],
  ["Amsterdam", "NL"], ["Rotterdam", "NL"], ["Brussels", "BE"],
  ["London", "GB"], ["Edinburgh", "GB"], ["Manchester", "GB"], ["Dublin", "IE"],
  ["Zurich", "CH"], ["Vienna", "AT"],
  ["Copenhagen", "DK"], ["Stockholm", "SE"], ["Oslo", "NO"], ["Helsinki", "FI"], ["Reykjavik", "IS"],
  ["Tallinn", "EE"], ["Riga", "LV"], ["Vilnius", "LT"],
  ["Prague", "CZ"], ["Brno", "CZ"], ["Warsaw", "PL"], ["Kraków", "PL", "Krakow"], ["Gdańsk", "PL", "Gdansk"], ["Wrocław", "PL", "Wroclaw"],
  ["Budapest", "HU"], ["Ljubljana", "SI"],
  // Southeastern Europe & Caucasus
  ["Split", "HR"], ["Zagreb", "HR"], ["Dubrovnik", "HR"],
  ["Sofia", "BG"], ["Plovdiv", "BG"], ["Varna", "BG"], ["Bansko", "BG"],
  ["Bucharest", "RO"], ["Cluj-Napoca", "RO"], ["Brașov", "RO", "Brasov"],
  ["Belgrade", "RS"], ["Novi Sad", "RS"], ["Budva", "ME"], ["Tirana", "AL"], ["Sarajevo", "BA"], ["Skopje", "MK"],
  ["Istanbul", "TR"], ["Antalya", "TR"], ["İzmir", "TR", "Izmir"],
  ["Tbilisi", "GE"], ["Batumi", "GE"], ["Yerevan", "AM"], ["Baku", "AZ"], ["Almaty", "KZ"],
  // Middle East
  ["Dubai", "AE"], ["Abu Dhabi", "AE"], ["Muscat", "OM"], ["Doha", "QA"], ["Tel Aviv", "IL", "Tel Aviv"],
  // Africa
  ["Marrakesh", "MA", "Marrakesh"], ["Casablanca", "MA"], ["Agadir", "MA"],
  ["Cairo", "EG"], ["Dahab", "EG"], ["Tunis", "TN"],
  ["Cape Town", "ZA"], ["Johannesburg", "ZA"], ["Nairobi", "KE"], ["Zanzibar City", "TZ", "Zanzibar"], ["Kigali", "RW"],
  ["Accra", "GH"], ["Dakar", "SN"], ["Lagos", "NG"], ["Port Louis", "MU", null, "Mauritius"],
  // South & Central Asia
  ["Panaji", "IN", null, "Goa"], ["Bengaluru", "IN", "Bengaluru"], ["Colombo", "LK"], ["Weligama", "LK"], ["Kathmandu", "NP"], ["Pokhara", "NP"],
  // Southeast Asia
  ["Bangkok", "TH"], ["Chiang Mai", "TH"], ["Phuket", "TH"], ["Krabi", "TH"], ["Hua Hin", "TH"],
  ["Ho Chi Minh City", "VN"], ["Hanoi", "VN"], ["Da Nang", "VN"], ["Hoi An", "VN"],
  ["Phnom Penh", "KH"], ["Siem Reap", "KH"],
  ["Kuala Lumpur", "MY"], ["George Town", "MY", null, "Penang"],
  ["Singapore", "SG"],
  ["Ubud", "ID", null, "Bali"], ["Jakarta", "ID"], ["Yogyakarta", "ID"],
  ["Manila", "PH"], ["Cebu City", "PH"],
  // East Asia
  ["Taipei", "TW"], ["Seoul", "KR"], ["Busan", "KR"], ["Tokyo", "JP"], ["Osaka", "JP"], ["Fukuoka", "JP"], ["Kyoto", "JP"], ["Hong Kong", "HK"],
  // Oceania
  ["Sydney", "AU"], ["Melbourne", "AU"], ["Brisbane", "AU"], ["Perth", "AU"], ["Auckland", "NZ"], ["Wellington", "NZ"],
  // North America
  ["New York City", "US"], ["San Francisco", "US"], ["Los Angeles", "US"], ["Austin", "US"], ["Miami", "US"], ["Denver", "US"], ["Seattle", "US"], ["Honolulu", "US"],
  ["Vancouver", "CA"], ["Toronto", "CA"], ["Montreal", "CA"],
  ["Mexico City", "MX"], ["Playa del Carmen", "MX"], ["Tulum", "MX"], ["Oaxaca", "MX", "Oaxaca de Juárez"], ["Guadalajara", "MX"], ["Puerto Vallarta", "MX"],
  ["Mérida", "MX", "Merida"], ["San Miguel de Allende", "MX"], ["Puerto Escondido", "MX"],
  // Central America & Caribbean
  ["Antigua Guatemala", "GT"], ["San José", "CR", "San Jose"], ["Panama City", "PA", "Panamá"], ["Santo Domingo", "DO"], ["Bridgetown", "BB", null, "Barbados"],
  // South America
  ["Medellín", "CO", "Medellin"], ["Bogotá", "CO", "Bogota"], ["Cartagena", "CO"], ["Santa Marta", "CO"], ["Cali", "CO"],
  ["Quito", "EC"], ["Cuenca", "EC"], ["Lima", "PE"], ["Cusco", "PE", "Cusco"], ["Arequipa", "PE"],
  ["Santiago", "CL"], ["Valparaíso", "CL", "Valparaiso"], ["Buenos Aires", "AR"], ["Mendoza", "AR"], ["Córdoba", "AR", "Cordoba"], ["Montevideo", "UY"],
  ["Rio de Janeiro", "BR"], ["São Paulo", "BR", "Sao Paulo"], ["Florianópolis", "BR", "Florianopolis"],
];
