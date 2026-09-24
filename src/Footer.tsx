import { CONTACT_EMAIL } from './configs/constants';

export function Footer() {
  return (
    <footer>
      <span>
        Please{' '}
        <a className="text-so-blue" href={`mailto:${CONTACT_EMAIL}`}>
          contact us
        </a>{' '}
        for questions or support
      </span>
      <span>
        Read{' '}
        <a
          className="text-so-blue"
          target="_blank"
          rel="noreferrer noopener"
          href={(import.meta.env.VITE_SERVICE_URL as string) + '/docs'}
        >
          the documentation
        </a>{' '}
        to learn more
      </span>
    </footer>
  );
}
