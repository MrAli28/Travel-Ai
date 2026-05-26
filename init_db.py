import sqlite3
import random
from datetime import datetime, timedelta

def init_db():
    conn = sqlite3.connect('travelai.db')
    cursor = conn.cursor()
    
    # Create bookings table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_ref TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        destination TEXT NOT NULL,
        duration TEXT NOT NULL,
        total_price REAL NOT NULL,
        status TEXT NOT NULL,
        card_number TEXT NOT NULL,
        travel_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Check if there is already data
    cursor.execute("SELECT COUNT(*) FROM bookings")
    if cursor.fetchone()[0] == 0:
        print("Seeding initial bookings...")
        
        destinations = [
            ("Paris, France", "5 Days, 4 Nights", 966.00),
            ("Rome, Italy", "4 Days, 3 Nights", 899.00),
            ("Bali, Indonesia", "7 Days, 6 Nights", 1250.00),
            ("Tokyo, Japan", "6 Days, 5 Nights", 1499.00),
            ("New York, USA", "5 Days, 4 Nights", 1150.00)
        ]
        
        first_names = ["Ahmad", "Ayesha", "Ali", "Zainab", "Hamza", "Fatima", "Sarah", "John", "Jessica", "Michael"]
        last_names = ["Khan", "Ali", "Rehman", "Sheikh", "Shah", "Siddiqui", "Doe", "Smith", "Johnson", "Davis"]
        statuses = ["Confirmed", "Pending", "Cancelled"]
        
        # Generate some mock bookings
        now = datetime.now()
        for i in range(12):
            dest, dur, price = random.choice(destinations)
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            email = f"{fn.lower()}.{ln.lower()}@example.com"
            phone = f"+92 (300) {random.randint(1000000, 9999999)}"
            ref = f"TAI-{random.randint(10000, 99999)}"
            status = random.choice(statuses)
            
            # Travel date is in the future
            travel_date = (now + timedelta(days=random.randint(10, 60))).strftime("%Y-%m-%d")
            card = f"**** **** **** {random.randint(1000, 9999)}"
            
            cursor.execute('''
            INSERT OR IGNORE INTO bookings 
            (booking_ref, first_name, last_name, email, phone, destination, duration, total_price, status, card_number, travel_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (ref, fn, ln, email, phone, dest, dur, price, status, card, travel_date))
            
        conn.commit()
        print("Database successfully seeded with initial mock bookings!")
    else:
        print("Database already contains bookings. Skipping seeding.")
        
    conn.close()

if __name__ == '__main__':
    init_db()
