test("GET to /api/v1/status should return 200", async () => {
  // Realiza uma requisição GET para o endpoint /api/v1/status
  const response = await fetch("http://localhost:3000/api/v1/status");
  // Verifica se o status da resposta é 200
  expect(response.status).toBe(200);
  // Analisa o corpo da resposta como JSON
  const responseBody = await response.json();
  // Verifica se o conteúdo de updated_at é uma data ISO válida
  const parsedUpdatedAt = new Date(responseBody.updated_at).toISOString();
  expect(responseBody.updated_at).toEqual(parsedUpdatedAt);
  // Verifica se a versão do banco de dados está correta
  expect(responseBody.dependddecies.version).toEqual("16.11");
  expect(responseBody.dependddecies.max_connections).toEqual(100);
  expect(responseBody.dependddecies.opened_connections).toEqual(1);
});
