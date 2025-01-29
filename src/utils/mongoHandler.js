export const generateDatabaseName = (lastDatabaseName) => {
  if (!lastDatabaseName) return new Date().getFullYear() + "_" + 1;

  const [year, rank] = lastDatabaseName.split("_");
  const newRank = parseInt(rank, 10) + 1;

  console.log(`${year}_${newRank}`);

  return `${year}_${newRank}`;
};

export const generateCollectionName = (dbName) => {
  const [year, rank] = dbName.split("_");
  const randomSuffix = Math.floor(Math.random() * Math.pow(10, 5))
    .toString()
    .padStart(5, "0");
  return `${year}${rank}${randomSuffix}`;
};

export const getDatabaseName = (collectionName) =>
  collectionName
    .toString()
    .slice(0, 5)
    .replace(/(\d{4})(\d)/, "$1_$2");
