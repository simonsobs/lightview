import { Link } from 'react-router';
import './styles/navigation.css';
import { Search } from './Search';
import { Login } from './Login';
import {
  APP_TITLE_CONFIG,
  IS_AUTH_ENABLED,
  IS_CROSSMATCH_ENABLED,
} from '../configs/constants';

/** Renders the app's Navigation bar/menu */
export function Navigation() {
  return (
    <div className="nav-container">
      <nav>
        <Link className="home-link" to="/">
          {APP_TITLE_CONFIG.orgName && (
            <p className="text-so-blue font-bold uppercase-subheader small-text so-header-label">
              Simons Observatory
            </p>
          )}
          <span>{APP_TITLE_CONFIG.appName}</span>
        </Link>
      </nav>
      <div className="search-login-container">
        {IS_CROSSMATCH_ENABLED && (
          <Link
            className="crossmatch-link-btn"
            title="Review unassigned LightcurveDB detections"
            to="/unassigned"
          >
            Cross Matcher
          </Link>
        )}
        <Search />
        {IS_AUTH_ENABLED && <Login />}
      </div>
    </div>
  );
}
