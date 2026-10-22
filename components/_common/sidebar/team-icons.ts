import type { ComponentType, SVGProps } from "react";
import type { TeamIcon } from "@/data/settings";
import TargetIcon from "@/public/assets/images/companies/sidebar/target-05.svg";
import TargetAltIcon from "@/public/assets/images/companies/sidebar/target-03.svg";
import UsersIcon from "@/public/assets/images/companies/sidebar/users.svg";

export const TEAM_ICON_COMPONENTS: Record<TeamIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  target: TargetIcon,
  "target-alt": TargetAltIcon,
  users: UsersIcon,
};
