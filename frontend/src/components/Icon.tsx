import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Folder,
  Grid2X2,
  Lock,
  Menu,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Star,
  Wallet,
  X,
  ChartNoAxesCombined,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

const icons = {
  grid: Grid2X2,
  db: Database,
  folder: Folder,
  calendar: Calendar,
  receipt: Receipt,
  chart: ChartNoAxesCombined,
  wallet: Wallet,
  lock: Lock,
  sparkle: Sparkles,
  gear: Settings,
  menu: Menu,
  bell: Bell,
  star: Star,
  search: Search,
  close: X,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
};

export type IconName = keyof typeof icons;
export interface IconProps extends LucideProps {
  name: IconName | string;
}

export function Icon({ name, ...props }: IconProps) {
  const Component = icons[name as IconName] ?? Grid2X2;
  return (
    <Component aria-hidden="true" size="20" strokeWidth="1.8" {...props} />
  );
}

export default Icon;
