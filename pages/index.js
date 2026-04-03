function Home() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.h1}>Sistema de Licenciamento Ambiental</h1>
        <p style={styles.subtitle}>
          Plataforma digital para os processos de licenciamento e gestão
          ambiental
        </p>
      </header>

      <main style={styles.main}>
        <section style={styles.section}>
          <h2 style={styles.h2}>Sistema em construção</h2>
          <p style={styles.p}>
            Este sistema encontra-se em fase de desenvolvimento. Seu objetivo é
            apoiar, organizar e dar maior eficiência aos processos
            administrativos e técnicos relacionados ao licenciamento ambiental.
          </p>
          <p style={styles.p}>
            Durante esta fase, funcionalidades poderão ser incluídas, ajustadas
            ou revisadas, sempre buscando maior clareza, rastreabilidade e
            padronização das informações.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Objetivos da plataforma</h2>
          <ul style={styles.ul}>
            <li>
              Centralizar informações dos processos de licenciamento ambiental;
            </li>
            <li>Padronizar dados técnicos e administrativos;</li>
            <li>Apoiar a análise técnica e a tomada de decisão;</li>
            <li>Reduzir retrabalho e inconsistências documentais;</li>
            <li>Aumentar a transparência e a organização dos fluxos.</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Funcionalidades previstas</h2>
          <ul style={styles.ul}>
            <li>Cadastro e acompanhamento de processos de licenciamento;</li>
            <li>
              Gestão de empreendimentos, responsáveis e intervenções ambientais;
            </li>
            <li>
              Geração automatizada de documentos técnicos e administrativos;
            </li>
            <li>Histórico de análises, exigências e manifestações;</li>
            <li>Integração com sistemas corporativos e bases oficiais;</li>
            <li>Relatórios gerenciais e apoio à fiscalização.</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Público-alvo</h2>
          <p style={styles.p}>
            O sistema é destinado ao uso interno por equipes técnicas, analistas
            ambientais, gestores e servidores envolvidos nos procedimentos de
            licenciamento ambiental, podendo futuramente oferecer módulos
            específicos para interação com interessados externos, conforme
            diretrizes institucionais.
          </p>
        </section>

        <div style={styles.alert}>
          <strong>Aviso importante:</strong>
          <p style={{ ...styles.p, marginTop: 8 }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur
            sed odio tincidunt, vulputate magna ultricies, iaculis velit.
            Praesent pharetra, ligula a tincidunt auctor, nisi erat semper enim,
            fringilla vulputate odio mauris aliquet metus. Nam diam leo,
            malesuada congue turpis a, maximus mollis justo.
          </p>
        </div>
      </main>

      <footer style={styles.footer}>
        Sistema de Licenciamento Ambiental — versão em desenvolvimento
      </footer>
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "Arial, Helvetica, sans-serif",
    margin: 0,
    backgroundColor: "#f5f7f8",
    color: "#333",
    lineHeight: 1.6,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    backgroundColor: "#1f5f4a",
    color: "#fff",
    padding: "24px",
  },
  h1: { margin: 0, fontSize: "1.8rem" },
  subtitle: { marginTop: 8, fontSize: "1rem", opacity: 0.9 },
  main: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "32px 24px",
    width: "100%",
    flex: 1,
  },
  section: { marginBottom: 40 },
  h2: { color: "#1f5f4a", marginBottom: 12 },
  p: { margin: "0 0 12px 0" },
  ul: { paddingLeft: 20, margin: 0 },
  alert: {
    backgroundColor: "#fff3cd",
    borderLeft: "6px solid #ffc107",
    padding: 16,
    marginTop: 24,
  },
  footer: {
    backgroundColor: "#e9ecef",
    textAlign: "center",
    padding: 16,
    fontSize: "0.9rem",
    color: "#555",
  },
};

export default Home;
