import { useEffect, useRef } from "react";
import "./Confetti.css";

const Confetti = ({ trigger }) => {
    const containerRef = useRef(null); // Reference to the container where confetti will be rendered

    // Trigger confetti animation when the 'trigger' prop changes
    useEffect(() => {
        if (trigger && containerRef.current) {
            const container = containerRef.current;
            const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffa500", "#800080"];
            const confettiCount = 150;

            // Create and animate confetti pieces
            for (let i = 0; i < confettiCount; i++) {
                const confetti = document.createElement("div"); // Create a new div for each piece
                const shapes = ["square", "circle", "triangle"]; // Possible shapes for confetti
                const shape = shapes[Math.floor(Math.random() * shapes.length)]; // Randomly select a shape
                confetti.className = `confetti-piece ${shape}`; // Apply the shape class
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; // Random color

                // Set random size between 5px and 15px
                const size = 5 + Math.random() * 10;
                confetti.style.width = `${size}px`;
                confetti.style.height = `${size}px`;

                // Use polar coordinates for random angle and distance
                const angle = Math.random() * 2 * Math.PI; // Random angle in radians
                const distance = 100 + Math.random() * 200; // Random distance in pixels
                confetti.style.setProperty("--end-x", `${Math.cos(angle) * distance}px`);
                confetti.style.setProperty("--end-y", `${Math.sin(angle) * distance}px`);

                // Set random animation duration between 0.5s and 1.5s
                confetti.style.animationDuration = `${0.5 + Math.random()}s`;

                confetti.style.animationDelay = `${Math.random() * 0.5}s`;

                container.appendChild(confetti); // Add the confetti to the container

                // Remove confetti when animation ends
                confetti.addEventListener("animationend", () => {
                    confetti.remove();
                });
            }
        }
    }, [trigger]);

    // Handle component mount and unmount
    useEffect(() => {
        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{
                position: "fixed",
                pointerEvents: "none",
                width: "100%",
                height: "100%",
                top: 0,
                left: 0,
                zIndex: 9999,
                background: "transparent",
                border: "1px solid red" // Red border for testing purposes
            }}
        />
    );
};

export default Confetti; 