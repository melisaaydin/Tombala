import { Routes, Route } from 'react-router-dom';
import Bingo from './Bingo';
import { UserProvider, useUser } from '@TOYOTA/game-center';
import { Bounce, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { LanguageProvider } from '@TOYOTA/game-center';


function TestComponent() {
  const { user, loading } = useUser();
  return (
    <div>
      {loading ? (
        <p style={{ color: "black" }}>Loading...</p>
      ) : user ? (
        <p>User: {user.name}</p>
      ) : (
        <p>No user</p>
      )}
    </div>
  );
}

function App() {
  return (

    <LanguageProvider>
      <UserProvider>
        <Routes>
          <Route path="/games/:gameId/lobby/:id" element={<Bingo />} />
          <Route path="/test" element={<TestComponent />} />
        </Routes>
        <ToastContainer
          position="bottom-left"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={false}
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          transition={Bounce}
        />
      </UserProvider>
    </LanguageProvider>


  );
}

export default App;