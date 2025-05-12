<?php
session_start();
if (!isset($_SESSION['user_email']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
    header('Location: ../auth/login.php?error=unauthorized');
    exit();
}
$adminName = $_SESSION['user_name'] ?? $_SESSION['user_email'];
// PHP logic to read/write platform settings from a JSON file would go here.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Platform Settings - EduNexus (Static)</title>
    <link rel="stylesheet" href="../css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <header>
        <h1>Platform Settings</h1>
         <nav class="admin-nav">
            <a href="dashboard.php">Dashboard</a>
            <a href="users.php">Users</a>
            <a href="tests.php">Tests</a>
            <a href="settings.php">Settings</a>
            <a href="../auth/logout.php">Logout (<?php echo htmlspecialchars($adminName); ?>)</a>
        </nav>
    </header>
    <main style="padding: 2rem;" class="admin-main-content">
        <h2 style="font-size: 1.8rem; margin-bottom: 1rem; color: #3498db;">Configure Platform</h2>
        <p style="margin-bottom: 2rem; color: #7f8c8d;">Manage site-wide configurations and settings.</p>

        <form method="POST" action="settings.php">
            <div class="form-group">
                <label for="maintenance_mode">Maintenance Mode:</label>
                <select name="maintenance_mode" id="maintenance_mode">
                    <option value="0">Disabled</option>
                    <option value="1">Enabled</option>
                </select>
            </div>
            <div class="form-group">
                <label for="new_registrations">Allow New Registrations:</label>
                <select name="new_registrations" id="new_registrations">
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                </select>
            </div>
            <!-- Add more settings fields as needed -->
            <div class="form-group">
                <button type="submit" class="cta-button" style="background-color: #1abc9c;">Save Settings</button>
            </div>
        </form>
        
    </main>
    <footer>
        <p>&copy; <?php echo date("Y"); ?> EduNexus. All rights reserved.</p>
    </footer>
</body>
</html>
