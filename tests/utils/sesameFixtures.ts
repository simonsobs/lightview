/** Trimmed copies of real Sesame (-ox/S) responses. */
export const sesameHit = (
  oname: string,
  ra: number,
  dec: number
) => `<?xml version="1.0" encoding="UTF-8"?>
<Sesame xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<Target option="S">
  <name>query</name>
  <Resolver name="Sc=Simbad (CDS, via client/server)">
    <INFO>from cache</INFO>
    <oid>1575544</oid>
    <jradeg>${ra}</jradeg>
    <jdedeg>${dec}</jdedeg>
    <oname>${oname}</oname>
  </Resolver>
</Target>
</Sesame>
<!--- ====Done (2026-Oct-16,15:34:16z)==== -->`;

export const SESAME_NOT_FOUND = `<?xml version="1.0" encoding="UTF-8"?>
<Sesame xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<Target option="S">
  <name>nope</name>
  <INFO> *** NNNothing found *** </INFO>
</Target>
</Sesame>
<!--- ****Total of 1 crashes -->`;

export const sesameError = (
  message: string
) => `<?xml version="1.0" encoding="UTF-8"?>
<Sesame>
<Target option="S">
  <name>M 31</name>
  <ERROR>${message}</ERROR>
</Target>
</Sesame>`;
