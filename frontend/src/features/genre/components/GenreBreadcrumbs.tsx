import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  _id: string;
  name: string;
  slug: string;
}

interface Props {
  items: BreadcrumbItem[];
  currentItem: string; // Tên genre hiện tại
}

export const GenreBreadcrumbs = ({ items, currentItem }: Props) => {
  return (
    <nav className="flex items-center text-sm text-muted-foreground mb-4 overflow-x-auto whitespace-nowrap no-scrollbar">
      <Link
        to="/"
        className="hover:text-primary transition-colors flex items-center gap-1"
      >
        <Home size={14} /> Home
      </Link>

      {items.map((item) => (
        <div key={item._id} className="flex items-center">
          <ChevronRight size={14} className="mx-1 opacity-50" />
          <Link
            to={`/genre/${item._id}`} // Hoặc dùng slug nếu route support
            className="hover:text-primary transition-colors font-medium"
          >
            {item.name}
          </Link>
        </div>
      ))}

      <div className="flex items-center">
        <ChevronRight size={14} className="mx-1 opacity-50" />
        <span className="text-foreground font-bold">{currentItem}</span>
      </div>
    </nav>
  );
};
export default GenreBreadcrumbs;
