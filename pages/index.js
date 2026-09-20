import DefaultLayout from "interface/DefaultLayout";

function Home() {
  return (
    <DefaultLayout
      metadata={{
        title: "Home",
        description: "Bem-vindo à página inicial da aplicação",
      }}
    >
      <h1>Welcome to the Home Page</h1>
      <p>This is the main landing page of the application.</p>
    </DefaultLayout>
  );
}

export default Home;
