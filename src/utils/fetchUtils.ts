import { CutoutFileExtensions } from '../types';

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

/**
 * A fetch utility that downloads a cutout of a source
 * @param cutoutId
 * @param ext One of the string literals defined in CutoutFileExtensions
 * @returns Nothing as of now
 */
export function fetchCutout(cutoutId: number, ext: CutoutFileExtensions) {
  const endpoint = `${import.meta.env.VITE_SERVICE_URL}/cutouts/flux/${cutoutId}?ext=${ext}`;

  fetch(endpoint, { method: 'GET' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error downloading the cutout: ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => {
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary anchor element to trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = `cutout-${cutoutId}.${ext}`; // Give it a filename
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Clean up the blob URL
      window.URL.revokeObjectURL(url);
    })
    .catch((error) => {
      console.error('Error downloading the file:', error);
    });
}
