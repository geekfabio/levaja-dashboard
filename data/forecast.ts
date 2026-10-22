import { OWNERS, type Team } from "./companies";

export const MONTHLY_TREND = [2, 4, 2, 5, 5, 7, 6, 9, 8, 11, 10, 12, 11, 14];

export const MONTHLY_TOTAL = 312_000_000;
export const MONTHLY_QUOTA = 360_000_000;

export type ManagerForecast = {
  name: string;
  avatar: string;
  amount: number;
  quota: number;
};

export const MANAGER_FORECAST: ManagerForecast[] = [
  { name: OWNERS[0].name, avatar: OWNERS[0].avatar, amount: 48_000_000, quota: 55_000_000 },
  { name: OWNERS[1].name, avatar: OWNERS[1].avatar, amount: 21_500_000, quota: 40_000_000 },
  { name: OWNERS[5].name, avatar: OWNERS[5].avatar, amount: 27_700_000, quota: 35_000_000 },
  { name: OWNERS[12].name, avatar: OWNERS[12].avatar, amount: 11_900_000, quota: 30_000_000 },
  { name: OWNERS[16].name, avatar: OWNERS[16].avatar, amount: 44_000_000, quota: 48_000_000 },
];

export type ZoneForecast = {
  zone: string;
  amount: number;
  quota: number;
};

export const ZONE_FORECAST: ZoneForecast[] = [
  { zone: "Luanda", amount: 198_000_000, quota: 220_000_000 },
  { zone: "Benguela", amount: 42_000_000, quota: 55_000_000 },
  { zone: "Huíla", amount: 28_500_000, quota: 40_000_000 },
  { zone: "Huambo", amount: 21_000_000, quota: 30_000_000 },
  { zone: "Resto do país", amount: 22_500_000, quota: 35_000_000 },
];

export type TeamForecast = {
  team: Team;
  quota: number;
};

export const TEAM_FORECAST: TeamForecast[] = [
  { team: "Grandes Contas", quota: 140_000_000 },
  { team: "Televendas", quota: 95_000_000 },
  { team: "Equipa de Rua", quota: 85_000_000 },
];
