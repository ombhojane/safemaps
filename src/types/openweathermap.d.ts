declare module 'openweathermap-ts' {
  export type CountryCode = 
    | 'AF' | 'AL' | 'DZ' | 'AS' | 'AD' | 'AO' | 'AI' | 'AQ' | 'AG' | 'AR'
    | 'AM' | 'AW' | 'AU' | 'AT' | 'AZ' | 'BS' | 'BH' | 'BD' | 'BB' | 'BY'
    | 'BE' | 'BZ' | 'BJ' | 'BM' | 'BT' | 'BO' | 'BA' | 'BW' | 'BV' | 'BR'
    | 'IO' | 'BN' | 'BG' | 'BF' | 'BI' | 'KH' | 'CM' | 'CA' | 'CV' | 'KY'
    | 'CF' | 'TD' | 'CL' | 'CN' | 'CX' | 'CC' | 'CO' | 'KM' | 'CG' | 'CD'
    | 'CK' | 'CR' | 'CI' | 'HR' | 'CU' | 'CY' | 'CZ' | 'DK' | 'DJ' | 'DM'
    | 'DO' | 'EC' | 'EG' | 'SV' | 'GQ' | 'ER' | 'EE' | 'ET' | 'FK' | 'FO'
    | 'FJ' | 'FI' | 'FR' | 'GF' | 'PF' | 'TF' | 'GA' | 'GM' | 'GE' | 'DE'
    | 'GH' | 'GI' | 'GR' | 'GL' | 'GD' | 'GP' | 'GU' | 'GT' | 'GN' | 'GW'
    | 'GY' | 'HT' | 'HM' | 'VA' | 'HN' | 'HK' | 'HU' | 'IS' | 'IN' | 'ID'
    | 'IR' | 'IQ' | 'IE' | 'IL' | 'IT' | 'JM' | 'JP' | 'JO' | 'KZ' | 'KE'
    | 'KI' | 'KP' | 'KR' | 'KW' | 'KG' | 'LA' | 'LV' | 'LB' | 'LS' | 'LR'
    | 'LY' | 'LI' | 'LT' | 'LU' | 'MO' | 'MK' | 'MG' | 'MW' | 'MY' | 'MV'
    | 'ML' | 'MT' | 'MH' | 'MQ' | 'MR' | 'MU' | 'YT' | 'MX' | 'FM' | 'MD'
    | 'MC' | 'MN' | 'MS' | 'MA' | 'MZ' | 'MM' | 'NA' | 'NR' | 'NP' | 'NL'
    | 'NC' | 'NZ' | 'NI' | 'NE' | 'NG' | 'NU' | 'NF' | 'MP' | 'NO' | 'OM'
    | 'PK' | 'PW' | 'PS' | 'PA' | 'PG' | 'PY' | 'PE' | 'PH' | 'PN' | 'PL'
    | 'PT' | 'PR' | 'QA' | 'RE' | 'RO' | 'RU' | 'RW' | 'SH' | 'KN' | 'LC'
    | 'PM' | 'VC' | 'WS' | 'SM' | 'ST' | 'SA' | 'SN' | 'SC' | 'SL' | 'SG'
    | 'SK' | 'SI' | 'SB' | 'SO' | 'ZA' | 'GS' | 'ES' | 'LK' | 'SD' | 'SR'
    | 'SJ' | 'SZ' | 'SE' | 'CH' | 'SY' | 'TW' | 'TJ' | 'TZ' | 'TH' | 'TL'
    | 'TG' | 'TK' | 'TO' | 'TT' | 'TN' | 'TR' | 'TM' | 'TC' | 'TV' | 'UG'
    | 'UA' | 'AE' | 'GB' | 'US' | 'UM' | 'UY' | 'UZ' | 'VU' | 'VE' | 'VN'
    | 'VG' | 'VI' | 'WF' | 'EH' | 'YE' | 'ZM' | 'ZW';

  export interface GetByCityNameParams {
    cityName: string;
    state?: string;
    countryCode?: CountryCode;
  }

  export default class OpenWeatherMap {
    constructor(options: { apiKey: string; units?: 'metric' | 'imperial' | 'standard' });
    
    setApiKey(apiKey: string): void;
    setUnits(units: 'metric' | 'imperial' | 'standard'): void;
    setLanguage(language: string): void;
    getAllSettings(): any;
    clearSettings(): void;
    
    setCityId(cityId: number): void;
    setCityName(params: { cityName: string; state?: string; countryCode?: CountryCode }): void;
    setGeoCoordinates(latitude: number, longitude: number): void;
    setZipCode(zipcode: number, countryCode?: CountryCode): void;
    getAllLocations(): any;
    clearLocation(): void;
    
    getCurrentWeatherByCityName(params: GetByCityNameParams): Promise<any>;
    getCurrentWeatherByCityId(cityId: number): Promise<any>;
    getCurrentWeatherByGeoCoordinates(latitude: number, longitude: number): Promise<any>;
    getCurrentWeatherByZipcode(zipcode: number, countryCode?: CountryCode): Promise<any>;
    
    getThreeHourForecastByCityName(params: GetByCityNameParams): Promise<any>;
    getThreeHourForecastByCityId(cityId: number): Promise<any>;
    getThreeHourForecastByGeoCoordinates(latitude: number, longitude: number): Promise<any>;
    getThreeHourForecastByZipcode(zipcode: number, countryCode?: CountryCode): Promise<any>;
  }
} 