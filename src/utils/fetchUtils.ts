import { CutoutFileExtensions, DataFileExtensions } from '../types';

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

/**
 * Helper function to download data
 * @param endpoint API endpoint string
 * @param filename Filename string
 * @param objectToDownload String describing the object to be downloaded; used in error response
 */
function downloadData(
  endpoint: string,
  filename: string,
  objectToDownload: string
) {
  fetch(endpoint, { method: 'GET' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Error downloading the ${objectToDownload}: ${response.status}`
        );
      }
      return response.blob();
    })
    .then((blob) => {
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary anchor element to trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename; // Give it a filename
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

/**
 *
 * @param object String describing the object to be downloaded
 * @param id ID of object used in the filename
 * @param ext File extension
 * @returns string
 */
function makeFileName(object: string, id: number, ext: string) {
  return `${object}-${id}.${ext}`;
}

/**
 * A fetch utility that downloads a cutout of a source
 * @param cutoutId ID of the cutout
 * @param ext One of the string literals defined in CutoutFileExtensions
 */
export function fetchCutout(cutoutId: number, ext: CutoutFileExtensions) {
  const endpoint = `${import.meta.env.VITE_SERVICE_URL}/cutouts/flux/${cutoutId}?ext=${ext}`;
  const object = 'cutout';
  const filename = makeFileName(object, cutoutId, ext);

  downloadData(endpoint, filename, object);
}

/**
 * A fetch utility that downloads a source's light curve data
 * @param sourceId ID of the source
 * @param ext One of the string literals defined in DataFileExtensions
 */
export function fetchTableData(sourceId: number, ext: DataFileExtensions) {
  const endpoint = `${import.meta.env.VITE_SERVICE_URL}/lightcurves/${sourceId}/all/download?ext=${ext}`;
  const object = 'source-data';
  const filename = makeFileName(object, sourceId, ext);

  downloadData(endpoint, filename, object);
}
