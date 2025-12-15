import database from "infra/database.js";

async function status(request, response) {
  const updatedAt = new Date().toISOString();
  // Obtém a versão do banco de dados
  const databaseVersionResult = await database.query("SHOW server_version;");
  const databaseVersionValue = databaseVersionResult.rows[0].server_version;
  // Obtém o número máximo de conexões do banco de dados
  const databaseMaxConnectionsResult = await database.query(
    "SHOW max_connections;",
  );
  const databaseMaxConnectionsValue =
    databaseMaxConnectionsResult.rows[0].max_connections;
  // Obtém o número de conexões abertas no banco de dados
  const databaseName = process.env.POSTGRES_DB;
  const databaseOpenConnectionsResult = await database.query({
    text: "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = $1;",
    values: [databaseName],
  });
  const databaseOpenConnectionsValue =
    databaseOpenConnectionsResult.rows[0].count;

  console.log(databaseOpenConnectionsValue);

  response.status(200).json({
    updated_at: updatedAt,
    dependddecies: {
      version: databaseVersionValue,
      max_connections: parseInt(databaseMaxConnectionsValue),
      opened_connections: parseInt(databaseOpenConnectionsValue),
    },
  });
}

export default status;
