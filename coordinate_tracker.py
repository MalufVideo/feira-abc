import tkinter as tk
import sys
from pynput import mouse
from screeninfo import get_monitors

# Get screen dimensions
monitor = get_monitors()[0]
screen_width, screen_height = monitor.width, monitor.height

# List to store click coordinates
click_history = []

def on_click(x, y, button, pressed):
    """Handle mouse clicks"""
    if pressed and button == mouse.Button.left:
        click_history.append((x, y))
        print(f"Clicked at: X={x}, Y={y}")
    elif not pressed and button == mouse.Button.right:
        # Right click release to exit
        if click_history:
            print("\nAll recorded coordinates:")
            for i, pos in enumerate(click_history):
                print(f"Point {i+1}: X={pos[0]}, Y={pos[1]}")
        return False

def on_move(x, y):
    """Update cursor position label"""
    # Update the coordinates in the overlay
    coords_label.config(text=f"X={x}, Y={y}")
    
    # Update the position of the overlay window
    # Position the window so the cursor is at the center of the cross
    root.geometry(f"+{x-15}+{y-15}")

def main():
    global root, coords_label
    
    # Create transparent overlay window
    root = tk.Tk()
    root.overrideredirect(True)  # Remove window decorations
    root.attributes("-topmost", True)  # Keep on top
    root.attributes("-alpha", 0.8)  # Semi-transparent
    root.configure(bg="white")
    root.wm_attributes("-transparentcolor", "white")  # Make white transparent
    
    # Create canvas for the crosshair
    canvas = tk.Canvas(root, width=100, height=100, bg="white", highlightthickness=0)
    canvas.pack(side=tk.LEFT)
    
    # Draw crosshair
    canvas.create_line(50, 35, 50, 65, fill="black", width=2)  # Vertical line
    canvas.create_line(35, 50, 65, 50, fill="black", width=2)  # Horizontal line
    
    # Create label for coordinates
    coords_label = tk.Label(root, text="X=0, Y=0", bg="white", font=("Arial", 10))
    coords_label.pack(side=tk.LEFT, padx=5)
    
    # Set up mouse listener
    listener = mouse.Listener(
        on_move=on_move,
        on_click=on_click
    )
    listener.start()
    
    # Instructions
    print("Coordinate Tracker")
    print("Left-click to record coordinates")
    print("Right-click to exit and show all recorded coordinates")
    
    # Start the tkinter main loop
    root.mainloop()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        # Handle Ctrl+C exit
        if click_history:
            print("\nAll recorded coordinates:")
            for i, pos in enumerate(click_history):
                print(f"Point {i+1}: X={pos[0]}, Y={pos[1]}")
        sys.exit(0)
