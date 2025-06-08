import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, IconButton, Avatar } from '@mui/material';
import { ExitToApp, Fullscreen } from '@mui/icons-material';
import { socket, useUser } from '@TOYOTA/game-center';
import Confetti from './Confetti';
import { useTranslation } from 'react-i18next';
import i18n from '@TOYOTA/game-center/i18n';
import { toast } from 'react-toastify';
import './Bingo.css';
import { FaArrowRight } from "react-icons/fa6";

// The main Bingo component for a multiplayer bingo game
const Bingo = () => {
    // Get translation function for i18n and game/room IDs from URL params
    const { t } = useTranslation('tombala');
    const { gameId, id } = useParams();
    const navigate = useNavigate();
    // Fetch user data and loading state from custom hook
    const { user, loading } = useUser();

    // State to manage the entire game, including board, players, and game progress
    const [gameState, setGameState] = useState({
        board: Array(27).fill(null), // Player's 3x9 bingo board
        selectedCells: [], // Cells marked by the player
        turn: null, // Current player's turn
        started: false, // Whether the game has started
        winner: null, // Winner of the game, if any
        players: [], // List of all players
        currentNumber: 1, // Latest drawn number
        drawnNumbers: [], // All numbers drawn so far
        playerColor: 'blue', // Player's assigned color
        cingoCount: 0, // Number of "cingo" (bingo line) achievements
        allBoards: {}, // Boards of all players
        allSelectedCells: {}, // Selected cells of all players
        allPlayerColors: {}, // Colors assigned to all players
    });

    // State for UI effects and game status
    const [isObstruct, setIsObstruct] = useState(false); // Blocks UI during certain actions
    const [drawnNumber, setDrawnNumber] = useState(null); // Latest drawn number for popup
    const [stars, setStars] = useState([false, false, false]); // Tracks "cingo" stars for display
    const [confettiTrigger, setConfettiTrigger] = useState(false); // Triggers confetti on win
    const pWinRef = useRef(null); // Reference to winner text element
    const restartBtnRef = useRef(null); // Reference to restart button
    const [starPosition, setStarPosition] = useState('center'); // Position of stars for animation
    const [hasJoined, setHasJoined] = useState(false); // Tracks if player has joined the game
    const [isLanguageReady, setIsLanguageReady] = useState(false); // Ensures language is loaded
    const [showPlayers, setShowPlayers] = useState(false); // Toggles other players' boards visibility
    const [, forceUpdate] = useState(0); // Forces re-render when language changes
    const isDrawingRef = useRef(false); // Prevents multiple simultaneous number draws

    // Synchronize language from localStorage on component mount
    useEffect(() => {
        const lng = localStorage.getItem('i18nextLng');

        // If a language is saved and differs from current, update it
        if (lng && i18n.language !== lng) {
            i18n.changeLanguage(lng).then(() => {
                setIsLanguageReady(true);
                forceUpdate((prev) => prev + 1); // Trigger re-render for translations
            }).catch((err) => console.error('Bingo.jsx: Language sync error:', err));
        } else {
            setIsLanguageReady(true); // Language is ready if no change needed
        }
    }, []);

    // Listen for language change events and update accordingly
    useEffect(() => {
        const onLanguageChange = (e) => {
            const lng = e.detail?.language;
            if (lng && i18n.language !== lng) {
                i18n.changeLanguage(lng).then(() => {
                    setIsLanguageReady(true);
                    forceUpdate((prev) => prev + 1); // Re-render for updated translations
                }).catch((err) => console.error('Bingo.jsx: Language change error:', err));
            }
        };
        window.addEventListener('languageChanged', onLanguageChange);
        // Clean up the event listener when component unmounts
        return () => window.removeEventListener('languageChanged', onLanguageChange);
    }, []);

    // Handle game setup, socket events, and user authentication
    useEffect(() => {
        // Check for a token in URL and save it to localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            localStorage.setItem('token', token);
        }
        // Wait for user data to load; redirect to login if no user
        if (loading) return;
        if (!user) {
            toast.error(t('loginRequired'));
            navigate('/login');
            return;
        }

        // Load saved game state from localStorage, if it exists
        const savedGameState = localStorage.getItem(`gameState_${gameId}_${id}_${user.id}`);
        if (savedGameState) {
            setGameState(JSON.parse(savedGameState));
        }
        localStorage.removeItem(`gameState_${gameId}_${id}_${user.id}`);
        // Join the game via socket if not already joined
        if (!hasJoined) {
            socket.emit('join_game', { gameName: gameId, id, userId: user.id });
            setHasJoined(true);
        }

        let reconnectAttempts = 0;
        const maxReconnectAttempts = 3;

        // Handle incoming game state updates from the server
        const handleGameState = (newState) => {
            // Validate the board; attempt to rejoin if invalid
            if (newState.board && !Array.isArray(newState.board)) {
                console.error(`Invalid board: userId=${user.id}, attempt=${reconnectAttempts + 1}`, newState);
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    setTimeout(() => {
                        socket.emit('join_game', { gameName: gameId, id, userId: user.id });
                    }, 1000 * reconnectAttempts);
                } else {
                    toast.error(t('invalidBoard'));
                    navigate(`/lobbies/${id}`);
                }
                return;
            }

            reconnectAttempts = 0;
            // Update game state with new data from server, preserving defaults if needed
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
                    allBoards: newState.allBoards || {}, // Use filtered boards from server
                    allSelectedCells: newState.allSelectedCells || prev.allSelectedCells || {},
                    allPlayerColors: newState.allPlayerColors || prev.allPlayerColors || {},
                };
                localStorage.setItem(`gameState_${gameId}_${id}_${user.id}`, JSON.stringify(updatedState));
                return updatedState;
            });
        };

        // Handle game win event, update UI, and show confetti
        const handleGameWon = ({ winner }) => {
            setGameState((prev) => ({ ...prev, winner }));
            if (pWinRef.current) {
                pWinRef.current.innerHTML = `${winner.toUpperCase()} ${t('won')} <i class="fa-solid fa-crown"></i>`;
            }
            if (restartBtnRef.current) {
                restartBtnRef.current.style.display = 'inline-flex';
            }
            setConfettiTrigger(true);
            playSound('win');
            setTimeout(() => setConfettiTrigger(false), 1000);
            // Notify user of win or loss
            if (winner === user.name) {
                toast.success(t('youWon'));
            } else {
                toast.info(t('gameWonBy', { winner }));
            }
        };

        // Handle new number drawn from the server
        const handleDrawNumber = ({ number, drawnNumbers }) => {
            setDrawnNumber(number);
            setTimeout(() => setDrawnNumber(null), 2000); // Show popup for 2 seconds
            setGameState((prev) => ({
                ...prev,
                currentNumber: number,
                drawnNumbers: drawnNumbers || prev.drawnNumbers,
            }));
            playSound('draw');
            isDrawingRef.current = false; // Reset drawing flag
        };

        // Notify when a new player joins the game
        const handlePlayerJoined = ({ playerName }) => {
            if (playerName !== user.name) {
                toast.info(t('playerJoined', { playerName }));
            }
        };

        // Update player's "cingo" count and animate stars
        const handleCingoUpdated = ({ userId, cingoCount }) => {
            if (userId === user.id) {
                playSound('cingo');
                setGameState((prev) => ({ ...prev, cingoCount }));
                setStarPosition('center');
                setStars((prev) => {
                    const newStars = [false, false, false];
                    for (let i = 0; i < cingoCount; i++) {
                        newStars[i] = true;
                    }
                    setTimeout(() => setStarPosition('right'), 500); // Animate stars to right
                    return newStars;
                });
                toast.success(t('cingoAchieved', { count: cingoCount }));
            }
        };

        // Notify when another player achieves a "cingo"
        const handleCingoNotification = ({ userId: cingoUserId, cingoCount, playerName }) => {
            if (cingoUserId !== user.id) {
                toast.info(t('otherPlayerCingo', { playerName: playerName || t('unknownPlayer'), count: cingoCount }));
            }
        };

        // Display error messages from the server
        const handleError = ({ message }) => {
            toast.error(t(message));
        };

        // Log successful socket connection
        const handleConnect = () => {
        };

        // Handle a player leaving the game and update state
        const handlePlayerLeft = ({ playerName }) => {
            toast.info(t('playerLeft', { playerName }));
            setGameState((prev) => {
                const updatedPlayers = prev.players.filter(p => p.name !== playerName);
                const updatedAllBoards = { ...prev.allBoards };
                const updatedAllSelectedCells = { ...prev.allSelectedCells };
                const updatedAllPlayerColors = { ...prev.allPlayerColors };
                const playerId = prev.players.find(p => p.name === playerName)?.id;
                if (playerId) {
                    delete updatedAllBoards[playerId]; // Remove player's board
                    delete updatedAllSelectedCells[playerId]; // Remove selected cells
                    delete updatedAllPlayerColors[playerId]; // Remove player color
                }
                const updatedState = {
                    ...prev,
                    players: updatedPlayers,
                    allBoards: updatedAllBoards,
                    allSelectedCells: updatedAllSelectedCells,
                    allPlayerColors: updatedAllPlayerColors,
                };
                localStorage.setItem(`gameState_${gameId}_${id}_${user.id}`, JSON.stringify(updatedState));
                return updatedState;
            });
        };

        // Attach socket event listeners
        socket.on('game_state', handleGameState);
        socket.on('game_won', handleGameWon);
        socket.on('draw_number', handleDrawNumber);
        socket.on('player_joined', handlePlayerJoined);
        socket.on('cingo_updated', handleCingoUpdated);
        socket.on('cingo_notification', handleCingoNotification);
        socket.on('error', handleError);
        socket.on('connect', handleConnect);
        socket.on('player_left', handlePlayerLeft);

        // Clean up socket listeners when component unmounts
        return () => {
            socket.off('game_state', handleGameState);
            socket.off('game_won', handleGameWon);
            socket.off('draw_number', handleDrawNumber);
            socket.off('player_joined', handlePlayerJoined);
            socket.off('cingo_updated', handleCingoUpdated);
            socket.off('cingo_notification', handleCingoNotification);
            socket.off('error', handleError);
            socket.off('connect', handleConnect);
            socket.off('player_left', handlePlayerLeft);
        };
    }, [gameId, id, user, navigate, loading, t, hasJoined]);

    // Check for invalid board after game starts and attempt to rejoin
    useEffect(() => {
        if (gameState.started && gameState.board.filter((cell) => cell !== null).length < 15) {
            toast.error(t('invalidBoard'));
            socket.emit('join_game', { gameName: gameId, id, userId: user.id });
        }
    }, [gameState.board, gameState.started, gameId, id, user, t]);

    // Handle clicking a cell on the board to mark a number
    const handleClick = (e, cellId) => {
        if (!gameState.started || gameState.winner) {
            return; // Do nothing if game hasn't started or has a winner
        }
        const row = parseInt(cellId[0], 10);
        const col = parseInt(cellId[1], 10);
        const index = row * 9 + col;
        const boardValue = gameState.board[index];

        // Check if the cell can be marked
        if (
            boardValue !== null &&
            boardValue !== undefined &&
            gameState.drawnNumbers.includes(boardValue) &&
            !gameState.selectedCells.includes(cellId)
        ) {
            socket.emit('make_move', { id, cellId, userId: user.id }); // Send move to server
        } else {
            // Show a warning if marking fails
            let reason = '';
            if (boardValue === null || boardValue === undefined) {
                reason = t('markingFailed_noNumber');
            } else if (!gameState.drawnNumbers.includes(boardValue)) {
                reason = t('markingFailed_notDrawn');
            } else if (gameState.selectedCells.includes(cellId)) {
                reason = t('markingFailed_alreadyMarked');
            }
            toast.warning(t('markingFailed', { reason }));
        }
    };

    // Start the game by emitting a socket event
    const handleStart = () => {
        socket.emit('start_game', { gameName: 'bingo', id, userId: user.id });
    };

    // Play sound effects for draw, cingo, or win events
    const playSound = (type) => {
        const audio = new Audio(
            type === 'draw' ? '/sounds/draw.mp3' : type === 'cingo' ? '/sounds/cingo.mp3' : '/sounds/win.mp3'
        );
        audio.play().catch(() => console.log('Sound playback error'));
    };

    // Exit the game, clear state, and redirect to lobby
    const handleExit = () => {
        socket.emit('leave_game', { id, userId: user.id });
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
            allBoards: {},
            allSelectedCells: {},
            allPlayerColors: {},
        });
        localStorage.removeItem(`gameState_${gameId}_${id}_${user.id}`);
        window.location.href = `http://localhost:3000/lobbies/${id}`;
    };

    // Draw a new number, with checks to prevent duplicate draws
    const drawNumber = useCallback(() => {
        if (isDrawingRef.current) {
            return;
        }

        if (!gameState.started || gameState.winner) {
            return;
        }

        if (gameState.turn !== user?.name) {
            toast.warning(t('notYourTurn'));
            return;
        }

        isDrawingRef.current = true;
        socket.emit('draw_number', { id, userId: user.id });
    }, [gameState, user, id, t]);

    // Reset the game state and UI for a new round
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
            allBoards: {},
            allSelectedCells: {},
            allPlayerColors: {},
        });
        setStars([false, false, false]);
        setIsObstruct(false);
        if (pWinRef.current && user) {
            pWinRef.current.innerHTML = user.name.toUpperCase();
        }
        if (restartBtnRef.current) {
            restartBtnRef.current.style.display = 'none';
        }
    };

    // Render the player's 3x9 bingo board
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
                        sx={{ cursor: hasNumber ? 'pointer' : 'auto' }}
                    >
                        {hasNumber && <Typography sx={{ fontSize: "30px", fontWeight: "700" }}>{gameState.board[index]}</Typography>}
                    </Box>
                );
            }
        }
        return board;
    };

    // Render other players' boards, visible only when game is active
    const renderOtherPlayersBoards = () => {


        // Don’t render if game hasn’t started, no other players, or no boards
        if (!gameState.started || gameState.players.length <= 1 || Object.keys(gameState.allBoards).length === 0) {
            return null;
        }

        // Filter active players with boards, excluding current user
        const activePlayersWithBoards = gameState.players.filter(
            player => player.id !== user.id && player.isActive && player.socketId && gameState.allBoards[player.id]
        );

        if (activePlayersWithBoards.length === 0) {
            return null;
        }

        return (
            <Box className="other-players-column">
                {activePlayersWithBoards.map(player => {
                    const playerBoard = gameState.allBoards[player.id] || Array(27).fill(null);
                    const playerSelectedCells = gameState.allSelectedCells?.[player.id] || [];
                    const playerColor = gameState.allPlayerColors[player.id] || 'blue';
                    const fullAvatarUrl = player.avatar_url ? `http://localhost:8081/uploads/${player.avatar_url}` : null;
                    return (
                        <Box key={player.id} className="player-board">
                            <Box className="player-info">
                                {fullAvatarUrl ? (
                                    <Avatar src={fullAvatarUrl} className="player-avatar" />
                                ) : (
                                    <Avatar className="player-avatar">{player.name?.[0] || 'B'}</Avatar>
                                )}
                                <Typography className="player-name">{player.name || t('unknownPlayer')}</Typography>
                            </Box>
                            <Box className={`player-board-grid border-${playerColor}`}>
                                {playerBoard.map((cell, index) => {
                                    const cellId = `${Math.floor(index / 9)}${index % 9}`;
                                    const isSelected = playerSelectedCells.includes(cellId);
                                    const hasNumber = cell !== null && cell !== undefined;
                                    return (
                                        <Box
                                            key={`${player.id}-${cellId}`}
                                            className={`box ${isSelected ? 'selected' : ''} ${hasNumber ? 'with-number' : 'without-number'} color-${playerColor}`}
                                        >
                                            {hasNumber && <Typography className="player-board-number">{cell}</Typography>}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        );
    };

    // Render stars to show "cingo" achievements
    const renderStars = () => (
        <Box className={`stars-container ${starPosition}`}>
            {stars.map((star, index) => (
                <span key={index} className={`star ${star ? 'lit' : ''}`}>★</span>
            ))}
        </Box>
    );

    // Render the list of drawn numbers
    const renderDrawnNumbers = () => (
        <Box className="drawn-numbers-wrapper">
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
        </Box>
    );

    // Show loading message until user data and language are ready
    if (loading || !isLanguageReady) {
        return <Typography>{t('loading')}</Typography>;
    }

    // Determine if the current user can draw a number
    const canDraw = !gameState.winner && (gameState.players.length <= 1 || gameState.turn === user?.name);

    // Render the main game UI
    return (
        <Box className={`tombalaContainer bg-${gameState.playerColor}`}>
            <Box className={`other-players-column-wrapper ${showPlayers ? 'visible' : ''}`}>
                <button className="close-players-btn" onClick={() => setShowPlayers(false)}>X</button>
                {renderOtherPlayersBoards()}
            </Box>
            <Box className={`overlay ${showPlayers ? 'active' : ''}`} onClick={() => setShowPlayers(false)}></Box>
            <button className="toggle-players-btn" onClick={() => setShowPlayers(true)}>
                <FaArrowRight />
            </button>
            <Box className="main-content">
                {isObstruct && <Box className="obstruct" />}
                <Box className="tombalaHeader">
                    <Box className="header-center">
                        <IconButton onClick={handleExit}>
                            <ExitToApp />
                        </IconButton>
                        <IconButton onClick={() => document.documentElement.requestFullscreen()}>
                            <Fullscreen />
                        </IconButton>
                        <Typography ref={pWinRef} variant="h6">
                            {user?.name?.toUpperCase() || t('player')}
                        </Typography>
                        {!gameState.started && (
                            <Button
                                onClick={handleStart}
                                variant="contained"
                                sx={{ bgcolor: "#3c3a3a", borderRadius: "10px", marginLeft: "20px" }}
                            >
                                {t('startGame')}
                            </Button>
                        )}
                        {gameState.winner && (
                            <Button
                                ref={restartBtnRef}
                                variant="contained"
                                sx={{ bgcolor: "#3c3a3a", borderRadius: "10px", marginLeft: "20px" }}
                                onClick={resetGame}
                            >
                                {t('restart')}
                            </Button>
                        )}
                    </Box>
                    <Box className="stars-right">{renderStars()}</Box>
                </Box>
                <Box className={`main border-${gameState.playerColor}`}>{renderBoard()}</Box>
                <Box className="drawn-numbers-wrapper">{renderDrawnNumbers()}</Box>
                <Box className={`bag-container ${canDraw ? '' : 'inactive'}`} onClick={drawNumber}>
                    <div className="bag">
                        <Typography>{t('bag')}</Typography>
                    </div>
                    {drawnNumber && (
                        <div className="drawn-number-popup">
                            <Typography variant="h4" sx={{ fontSize: "20px", fontWeight: "700" }}>{drawnNumber}</Typography>
                        </div>
                    )}
                </Box>
                <Confetti trigger={confettiTrigger} />
            </Box>
        </Box>
    );
};

export default Bingo;