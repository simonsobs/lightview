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
 * @param sourceId ID of the cutout's source
 * @param measurementId ID of the measurement for cutouts or null if table data
 * @param ext File extension
 * @returns string
 */
function makeFileName(
  object: string,
  sourceId: string,
  measurementId: string | null,
  ext: string
) {
  let filename = `${object}-${sourceId}`;
  if (measurementId) {
    filename += `-${measurementId}`;
  }
  return filename + `.${ext}`;
}

/**
 * A fetch utility that downloads a cutout of a source
 * @param sourceId ID of the cutout's source
 * @param measurementId ID of the measurement
 * @param ext One of the string literals defined in CutoutFileExtensions
 */
export function fetchCutout(
  sourceId: string,
  measurementId: string,
  ext: CutoutFileExtensions
) {
  const endpoint = `${import.meta.env.VITE_SERVICE_URL}/cutouts/flux/${sourceId}/${measurementId}?ext=${ext}`;
  const object = 'cutout';
  const filename = makeFileName(object, sourceId, measurementId, ext);

  downloadData(endpoint, filename, object);
}

/**
 * A fetch utility that downloads a source's light curve data
 * @param sourceId ID of the source
 * @param ext One of the string literals defined in DataFileExtensions
 */
export function fetchTableData(sourceId: string, ext: DataFileExtensions) {
  const endpoint = `${import.meta.env.VITE_SERVICE_URL}/lightcurves/${sourceId}/all/download?format=${ext}`;
  const object = 'source-data';
  const filename = makeFileName(object, sourceId, null, ext);

  downloadData(endpoint, filename, object);
}
