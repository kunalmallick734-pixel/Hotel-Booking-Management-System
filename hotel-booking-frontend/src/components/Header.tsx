import { useNavigate } from "react-router-dom";
import useSearchContext from "../hooks/useSearchContext";
import MobileNav from "./MobileNav";
import MainNav from "./MainNav";
import PageContainer from "./PageContainer";
import { Building2 } from "lucide-react";

const Header = () => {
  const search = useSearchContext();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    search.clearSearchValues();
    navigate("/");
  };

  return (
    <header className="bg-gradient-to-r from-red-900 via-rose-900 to-red-950 shadow-lg sticky top-0 z-50 h-[72px] flex items-center shrink-0 border-b border-red-800/30">
      <PageContainer>
        <div className="flex justify-between items-center h-full">
          <button
            onClick={handleLogoClick}
            className="flex items-center space-x-2 group"
          >
            <div className="bg-white/95 p-2 rounded-xl shadow-md group-hover:scale-105 transition-all duration-300">
              <Building2 className="w-6 h-6 text-red-700" />
            </div>
            <span className="text-xl md:text-2xl font-bold text-white tracking-tight group-hover:text-red-100 transition-colors flex items-center gap-1">
              Roomzy
            </span>
          </button>
          <div className="md:hidden">
            <MobileNav />
          </div>
          <div className="hidden md:flex items-center">
            <MainNav />
          </div>
        </div>
      </PageContainer>
    </header>
  );
};

export default Header;
