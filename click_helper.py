import pyautogui
import sys
import time

def click_at_coordinates(x, y, delay=0):
    """Click at the specified coordinates after an optional delay"""
    try:
        # Wait for the specified delay
        if delay > 0:
            time.sleep(delay)
        
        # Move to the coordinates
        pyautogui.moveTo(x, y, duration=0.5)
        
        # Perform the click
        pyautogui.click()
        
        print(f"Successfully clicked at coordinates X={x}, Y={y}")
        return True
    except Exception as e:
        print(f"Error clicking at coordinates: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python click_helper.py <x_coordinate> <y_coordinate> [delay_seconds]")
        sys.exit(1)
    
    x = int(sys.argv[1])
    y = int(sys.argv[2])
    delay = float(sys.argv[3]) if len(sys.argv) > 3 else 0
    
    click_at_coordinates(x, y, delay)
