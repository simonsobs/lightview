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
      <a href="https://identity.simonsobservatory.org/">Log in</a>
      <Search />
    </div>
  );
}
