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
      <a href="https://ingress.simonsobs-identity.production.svc.spin.nersc.org/login/06812848-dc48-70d5-8000-61f2245b92ba">
        Log in
      </a>
      <Search />
    </div>
  );
}
