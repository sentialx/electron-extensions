let nextIsolatedWorldId = 1000;
const isolatedWorldsRegistry: any = {};

export const getIsolatedWorldId = (id: string) => {
  if (isolatedWorldsRegistry[id]) {
    return isolatedWorldsRegistry[id];
  }
  nextIsolatedWorldId++;
  return (isolatedWorldsRegistry[id] = nextIsolatedWorldId);
};
