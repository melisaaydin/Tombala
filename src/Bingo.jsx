import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, IconButton, Alert, Snackbar } from '@mui/material';
import { ExitToApp, Fullscreen } from '@mui/icons-material';
import { socket } from '@TOYOTA/game-center';
import { useUser } from '@TOYOTA/game-center';
import Confetti from './Confetti';
import './Bingo.css';

const Bingo = () => {
    const { gameId, id } = useParams(); // Get gameId and lobby id from the URL
    const navigate = useNavigate(); // Hook to navigate between routes
    const { user, loading } = useUser(); // Get user data and loading state
    const [gameState, setGameState] = useState({
        board: Array(27).fill(null), // Initialize a 3x9 board with null values
        selectedCells: [], // Track selected cells
        turn: null, // Current player's turn
        started: false, // Game start status
        winner: null, // Winner of the game
        players: [], // List of players
        currentNumber: 1, // Current drawn number
        drawnNumbers: [], // List of all drawn numbers
        playerColor: 'blue', // Player's assigned color
        cingoCount: 0, // Count of completed bingo lines
    });
    const [isObstruct, setIsObstruct] = useState(false); // State to control overlay visibility
    const [drawnNumber, setDrawnNumber] = useState(null); // Store the most recently drawn number
    const [stars, setStars] = useState([false, false, false]); // Track lit stars for bingo achievements
    const [confettiTrigger, setConfettiTrigger] = useState(false); // Trigger for confetti animation
    const pWinRef = useRef(null); // Reference to the winner text element
    const restartBtnRef = useRef(null); // Reference to the restart button
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' }); // State for snackbar notifications
    const [starPosition, setStarPosition] = useState('center'); // Position of the stars display

    // Handle initial setup and socket events
    useEffect(() => {
        // Check for token in URL and save it to localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            localStorage.setItem('token', token);
        }
        if (loading) return; // Wait if user data is still loading
        if (!user) {
            console.log('User not found, redirecting to login page');
            setSnackbar({ open: true, message: 'Please log in!', severity: 'error' });
            navigate('/login');
            return;
        }

        // Load saved game state from localStorage if it exists
        const savedGameState = localStorage.getItem(`gameState_${gameId}_${id}_${user.id}`);
        if (savedGameState) {
            setGameState(JSON.parse(savedGameState));
        }

        console.log(`Loading Bingo lobby ${id}`);
        socket.emit('join_game', { gameName: gameId, id, userId: user.id }); // Join the game room
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 3;

        // Update game state when receiving new data from the server
        socket.on('game_state', (newState) => {

            if (newState.board && !Array.isArray(newState.board)) {
                console.error(`Invalid board received: userId=${user.id}, attempt=${reconnectAttempts + 1}`, newState);
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    setTimeout(() => {
                        socket.emit('join_game', { gameName: gameId, id, userId: user.id });
                    }, 1000 * reconnectAttempts); // Retry with increasing delay
                } else {
                    console.error('Maximum reconnect attempts exceeded.');
                    setSnackbar({
                        open: true,
                        message: 'Board failed to load, returning to lobby.',
                        severity: 'error',
                    });
                    navigate(`/lobbies/${id}`);
                }
                return;
            }

            reconnectAttempts = 0;
            setGameState((prev) => {
                const updatedState = {
                    ...prev,
                    board: newState.board && Array.isArray(newState.board) ? newState.board : prev.board,
                    selectedCells: Array.isArray(newState.selectedCells) ? newState.selectedCells : prev.selectedCells || [],
                    playerColor: newState.playerColor || prev.playerColor || 'blue',
                    cingoCount: newState.cingoCount !== undefined ? newState.cingoCount : prev.cingoCount || 0,
                    players: newState.players || prev.players || [],
                    turn: newState.turn !== undefined ? newState.turn : prev.turn,
                    started: newState.started !== undefined ? newState.started : prev.started,
                    winner: newState.winner !== undefined ? newState.winner : prev.winner,
                    currentNumber: newState.currentNumber !== undefined ? newState.currentNumber : prev.currentNumber,
                    drawnNumbers: newState.drawnNumbers || prev.drawnNumbers || [],
                };
                localStorage.setItem(`gameState_${gameId}_${id}_${user.id}`, JSON.stringify(updatedState));
                return updatedState;
            });
        });

        // Handle error messages from the server
        socket.on('error', ({ message }) => {
            setSnackbar({ open: true, message, severity: 'error' });
        });

        // Handle game win event
        socket.on('game_won', ({ winner }) => {
            console.log(`Game won: winner=${winner}`);
            setGameState((prev) => {
                const updatedState = { ...prev, winner };
                return updatedState;
            });
            if (pWinRef.current) {
                pWinRef.current.innerHTML = `${winner.toUpperCase()} WON <i class="fa-solid fa-crown"></i>`;
            }
            if (restartBtnRef.current) {
                restartBtnRef.current.style.display = 'inline-flex';
            }
            setConfettiTrigger(true); // Trigger confetti animation
            playSound("win"); // Play win sound
            setTimeout(() => setConfettiTrigger(false), 1000); // Stop confetti after 1 second
        });

        // Handle number draw event
        socket.on('draw_number', ({ number, drawnNumbers }) => {
            setDrawnNumber(number); // Display the drawn number
            setTimeout(() => setDrawnNumber(null), 2000); // Hide after 2 seconds
            setGameState((prev) => ({
                ...prev,
                currentNumber: number,
                drawnNumbers: drawnNumbers || prev.drawnNumbers,
            }));
            playSound("draw");
        });

        // Notify when a new player joins
        socket.on('player_joined', ({ playerName }) => {
            if (playerName !== user.name) {
                setSnackbar({
                    open: true,
                    message: `${playerName} joined the game!`,
                    severity: 'info',
                });
            }
        });

        // Update bingo count when achieved
        socket.on('cingo_updated', ({ userId, cingoCount }) => {
            if (userId === user.id) {
                playSound("cingo");
                setGameState((prev) => {
                    const updatedState = { ...prev, cingoCount };
                    console.log('Bingo state updated:', updatedState);
                    return updatedState;
                });
                setStarPosition('center');
                setStars((prev) => {
                    const newStars = [false, false, false];
                    for (let i = 0; i < cingoCount; i++) {
                        newStars[i] = true;
                    }
                    setTimeout(() => setStarPosition('right'), 500);
                    console.log('Stars updated:', newStars);
                    return newStars;
                });
                setSnackbar({
                    open: true,
                    message: `${cingoCount}. Bingo!`,
                    severity: 'success',
                });
            }
        });

        // Rejoin game on socket reconnect
        socket.on('connect', () => {
            socket.emit('join_game', { gameName: gameId, id, userId: user.id });
        });

        // Cleanup socket listeners on unmount
        return () => {
            socket.off('game_state');
            socket.off('game_won');
            socket.off('draw_number');
            socket.off('player_joined');
            socket.off('cingo_updated');
            socket.off('connect');
            socket.off('error');
        };
    }, [gameId, id, user, navigate, loading]);

    // Log game state changes for debugging
    useEffect(() => {
    }, [user, gameState.turn, gameState.players, gameState.board, gameState.drawnNumbers]);

    // Validate board integrity
    useEffect(() => {
        if (gameState.started && gameState.board.filter(cell => cell !== null).length < 15) {
            setSnackbar({
                open: true,
                message: 'Board is invalid, please refresh the page.',
                severity: 'error',
            });
            socket.emit('join_game', { gameName: gameId, id, userId: user.id });
        }
    }, [gameState.board, gameState.started]);

    // Handle cell click to mark numbers
    const handleClick = (e, cellId) => {
        if (!gameState.started || gameState.winner) {
            return;
        }
        const row = parseInt(cellId[0], 10);
        const col = parseInt(cellId[1], 10);
        const index = row * 9 + col;
        const boardValue = gameState.board[index];

        if (
            boardValue !== null &&
            boardValue !== undefined &&
            gameState.drawnNumbers.includes(boardValue) &&
            !gameState.selectedCells.includes(cellId)
        ) {
            socket.emit('make_move', { id, cellId, userId: user.id });
        } else {
            let errorMessage = 'Marking failed: ';
            if (boardValue === null || boardValue === undefined) {
                errorMessage += 'No valid number in the cell.';
            } else if (!gameState.drawnNumbers.includes(boardValue)) {
                errorMessage += 'This number is not in the drawn numbers.';
            } else if (gameState.selectedCells.includes(cellId)) {
                errorMessage += 'This cell is already marked.';
            }
            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'warning',
            });
        }
    };

    // Start the game
    const handleStart = () => {
        socket.emit('start_game', { gameName: 'bingo', id, userId: user.id });
    };

    // Play sound effects based on event type
    const playSound = (type) => {
        const audio = new Audio(type === "draw" ? "/sounds/draw.mp3" : type === "cingo" ? "/sounds/cingo.mp3" : "/sounds/win.mp3");
        audio.play();
    };

    // Draw a new number
    const drawNumber = () => {
        const canDraw = !gameState.winner && (gameState.players.length <= 1 || gameState.turn === user?.name);
        if (canDraw) {
            socket.emit('draw_number', { id, userId: user.id });
        } else {
            setSnackbar({
                open: true,
                message: 'It’s not your turn!',
                severity: 'warning',
            });
        }
    };

    // Reset the game to initial state
    const resetGame = () => {
        socket.emit('reset_game', { id });
        setGameState({
            board: Array(27).fill(null),
            selectedCells: [],
            turn: null,
            started: false,
            winner: null,
            players: [],
            currentNumber: 1,
            drawnNumbers: [],
            playerColor: 'blue',
            cingoCount: 0,
        });
        setStars([false, false, false]);
        setIsObstruct(false);
        if (pWinRef.current && user) {
            pWinRef.current.innerHTML = user.name.toUpperCase();
        }
        if (restartBtnRef.current) {
            restartBtnRef.current.style.display = 'none';
        }
        console.log('Game reset');
    };

    // Render the bingo board
    const renderBoard = () => {
        const board = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 9; j++) {
                const cellId = `${i}${j}`;
                const index = i * 9 + j;
                const isSelected = gameState.selectedCells.includes(cellId);
                const hasNumber = index < 27 && gameState.board[index] !== null && gameState.board[index] !== undefined;
                board.push(
                    <Box
                        key={cellId}
                        className={`box ${isSelected ? 'selected' : ''} ${hasNumber ? 'with-number' : 'without-number'} color-${gameState.playerColor}`}
                        id={cellId}
                        onClick={(e) => hasNumber && handleClick(e, cellId)}
                        sx={{
                            cursor: hasNumber ? 'pointer' : 'auto',
                        }}
                    >
                        {hasNumber && <Typography>{gameState.board[index]}</Typography>}
                    </Box>
                );
            }
        }
        return board;
    };

    // Render the stars indicating bingo achievements
    const renderStars = () => {
        return (
            <Box className={`stars-container ${starPosition}`}>
                {stars.map((star, index) => (
                    <span key={index} className={`star ${star ? 'lit' : ''}`}>
                        ★
                    </span>
                ))}
            </Box>
        );
    };

    // Render the list of drawn numbers
    const renderDrawnNumbers = () => {
        console.log('Rendering drawn numbers:', gameState.drawnNumbers);
        return (
            <Box className="drawn-numbers-container">
                {gameState.drawnNumbers.map((num, index) => (
                    <div
                        key={num}
                        className="drawn-number"
                        style={{ transition: 'transform 0.5s', transform: 'translateY(0)' }}
                    >
                        {num}
                    </div>
                ))}
            </Box>
        );
    };

    if (loading) {
        return <Typography>Loading...</Typography>;
    }

    const canDraw = !gameState.winner && (gameState.players.length <= 1 || gameState.turn === user?.name);

    return (
        <Box className={`tombalaContainer bg-${gameState.playerColor}`}>
            {isObstruct && <Box className="obstruct" />}
            <Box className="tombalaHeader">
                <Box className="header-center">
                    <IconButton onClick={() => (window.location.href = `http://localhost:3000/lobbies/${id}`)}>
                        <ExitToApp />
                    </IconButton>
                    <IconButton onClick={() => document.documentElement.requestFullscreen()}>
                        <Fullscreen />
                    </IconButton>
                    <Typography ref={pWinRef} variant="h6">
                        {user?.name?.toUpperCase() || 'PLAYER'}
                    </Typography>
                    {gameState.winner && (
                        <Button
                            ref={restartBtnRef}
                            variant="contained"
                            sx={{ display: 'inline-flex' }}
                            onClick={resetGame}
                        >
                            Restart
                        </Button>
                    )}
                </Box>
                <Box className="stars-right">{renderStars()}</Box>
            </Box>
            <Box className={`main border-${gameState.playerColor}`}>{renderBoard()}</Box>
            <Box className="drawn-numbers-wrapper">{renderDrawnNumbers()}</Box>
            <Box className={`bag-container ${canDraw ? '' : 'inactive'}`} onClick={drawNumber}>
                <div className="bag">
                    <Typography>{'Bag'}</Typography>
                </div>
                {drawnNumber && (
                    <div className="drawn-number-popup">
                        <Typography variant="h4">{drawnNumber}</Typography>
                    </div>
                )}
            </Box>
            {!gameState.started && (
                <Button onClick={handleStart} variant="contained" sx={{ mt: 2 }}>
                    Start Game
                </Button>
            )}

            <Confetti trigger={confettiTrigger} />
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    );
};

export default Bingo; 