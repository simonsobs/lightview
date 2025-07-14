import { Link } from 'react-router';
import './styles/navigation.css';
import { Search } from './Search';
import { Login } from './Login';

/** Renders the app's Navigation bar/menu */
export function Navigation() {
  return (
    <div className="nav-container">
      <nav>
        <Link className="home-link" to="/">
          <span>Simons Observatory Lightcurves</span>
        </Link>
      </nav>
      <div className="search-login-container">
        <Search />
        <Login />
      </div>
    </div>
  );
}
