<?php
session_start();
// Check if user is logged in and is an Admin
if (!isset($_SESSION['user_email']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
    // If not admin, redirect to login page
    header('Location: ../auth/login.php?error=unauthorized');
    exit();
}
$adminName = $_SESSION['user_name'] ?? $_SESSION['user_email'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - EduNexus (Static)</title>
    <link rel="stylesheet" href="../css/style.css">
    <style>
        .admin-main-content { padding: 2rem; }
        .admin-welcome { font-size: 1.5rem; margin-bottom: 1rem; }
        .admin-quick-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .action-card { background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; }
        .action-card h3 { margin-top: 0; color: #5e35b1; }
        .action-card a { text-decoration: none; color: inherit; }
        .action-card:hover { transform: translateY(-3px); box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
    </style>
</head>
<body>
    <header>
        <h1>Admin Dashboard</h1>
        <nav class="admin-nav">
            <a href="dashboard.php">Dashboard</a>
            <a href="users.php">Manage Users</a>
            <a href="tests.php">Manage Tests</a>
            <a href="../auth/logout.php">Logout (<?php echo htmlspecialchars($adminName); ?>)</a>
        </nav>
    </header>
    <main class="admin-main-content">
        <h2 class="admin-welcome">Welcome, <?php echo htmlspecialchars($adminName); ?>!</h2>
        <p>This is the EduNexus Admin Panel. Select an option below to manage the platform.</p>
        
        <div class="admin-quick-actions">
            <div class="action-card">
                <a href="users.php">
                    <h3>Manage Users</h3>
                    <p>View, edit, and manage user accounts.</p>
                </a>
            </div>
            <div class="action-card">
                <a href="tests.php">
                    <h3>Manage Tests</h3>
                    <p>Create, edit, and manage test series.</p>
                </a>
            </div>
            <div class="action-card">
                <a href="#"> 
                    <h3>Question Bank</h3>
                    <p>Administer the question database.</p>
                </a>
            </div>
             <div class="action-card">
                <a href="#"> 
                    <h3>Platform Settings</h3>
                    <p>Configure site-wide settings.</p>
                </a>
            </div>
        </div>
    </main>
    <footer>
        <p>&copy; <?php echo date("Y"); ?> EduNexus</p>
    </footer>
</body>
</html>
