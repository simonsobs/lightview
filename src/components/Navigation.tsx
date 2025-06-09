import { Link } from 'react-router';
import './styles/navigation.css';
import { Search } from './Search';

/** Renders the app's Navigation bar/menu */
export function Navigation() {
  return (
    <div className="nav-container">
      <nav>
        <Link className="home-link" to="/">
          <span>Simons Observatory Lightcurves</span>
        </Link>
      </nav>
      <a href={import.meta.env.VITE_LOGIN_SERVICE as string}>Log in</a>
      <Search />
    </div>
  );
}
