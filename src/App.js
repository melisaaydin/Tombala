// packages/tombala/src/App.js
import { Routes, Route } from 'react-router-dom';
import Bingo from './Bingo';
import { UserProvider, useUser } from '@TOYOTA/game-center';

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
    <UserProvider>
      <Routes>
        <Route path="/games/:gameId/lobby/:id" element={<Bingo />} />
        <Route path="/test" element={<TestComponent />} />
      </Routes>
    </UserProvider>
  );
}

export default App;