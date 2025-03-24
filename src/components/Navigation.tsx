import { Link } from 'react-router';
import './styles/navigation.css';

export function Navigation() {
  return (
    <div className="nav-container">
      <nav>
        <Link className="home-link" to="/">
          <span>Simons Observatory Lightcurves</span>
        </Link>
      </nav>
    </div>
  );
}
