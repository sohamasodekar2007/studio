<?php
session_start();
// Check if user is logged in and is an Admin
if (!isset($_SESSION['user_email']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
    // If not admin, redirect to login page
    header('Location: ../auth/login.php?error=unauthorized');
    exit();
}
$adminName = $_SESSION['user_name'] ?? $_SESSION['user_email'];

// Placeholder stats - in a real app, fetch this data
$totalUsers = 0; // Fetch from users.json count
$activeTests = 0; // Fetch from test_pages count
$recentSignups = 0; // Logic to determine recent signups
$totalRevenue = 0; // Placeholder for revenue

$users_file_path = __DIR__ . '/../data/users.json';
if (file_exists($users_file_path)) {
    $users_data = json_decode(file_get_contents($users_file_path), true);
    if (is_array($users_data)) {
        $totalUsers = count($users_data);
        // Example: count signups in last 24 hours
        foreach ($users_data as $user_item) {
            if (isset($user_item['createdAt']) && strtotime($user_item['createdAt']) > (time() - 86400)) {
                $recentSignups++;
            }
        }
    }
}
// Similar logic for tests (requires scanning test_pages directory)

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - EduNexus (Static)</title>
    <link rel="stylesheet" href="../css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <header>
        <h1>EduNexus Admin Dashboard</h1>
        <nav class="admin-nav">
            <a href="dashboard.php">Dashboard</a>
            <a href="users.php">Users</a>
            <a href="tests.php">Tests</a>
            <!-- Add more nav items as needed -->
            <a href="settings.php">Settings</a>
            <a href="../auth/logout.php">Logout (<?php echo htmlspecialchars($adminName); ?>)</a>
        </nav>
    </header>
    <main class="admin-main-content">
        <h2 class="admin-welcome">Welcome, <?php echo htmlspecialchars($adminName); ?>!</h2>
        <p style="margin-bottom: 2rem; color: #7f8c8d;">Overview of platform activity and management tools.</p>
        
        <!-- Stats Cards -->
        <div class="admin-quick-actions" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 2rem;">
            <div class="action-card" style="background-color: #e3f2fd; border-left: 5px solid #2196f3;">
                <h3>Total Users</h3>
                <p style="font-size: 2rem; font-weight: bold; color: #1e88e5;"><?php echo $totalUsers; ?></p>
            </div>
            <div class="action-card" style="background-color: #e8f5e9; border-left: 5px solid #4caf50;">
                <h3>Total Tests</h3>
                <p style="font-size: 2rem; font-weight: bold; color: #388e3c;"><?php echo $activeTests; ?></p>
            </div>
            <div class="action-card" style="background-color: #fff3e0; border-left: 5px solid #fb8c00;">
                <h3>Recent Signups (24h)</h3>
                <p style="font-size: 2rem; font-weight: bold; color: #f57c00;">+<?php echo $recentSignups; ?></p>
            </div>
             <div class="action-card" style="background-color: #fce4ec; border-left: 5px solid #e91e63;">
                <h3>Total Revenue</h3>
                <p style="font-size: 2rem; font-weight: bold; color: #d81b60;">$<?php echo number_format($totalRevenue, 2); ?></p>
            </div>
        </div>

        <h3 style="font-size: 1.5rem; margin-bottom: 1rem; color: #2c3e50;">Quick Actions</h3>
        <div class="admin-quick-actions">
            <div class="action-card">
                <a href="users.php">
                    <h3>Manage Users</h3>
                    <p>View, edit, and manage user accounts.</p>
                </a>
            </div>
            <div class="action-card">
                <a href="tests.php"> <!-- Link to new test management -->
                    <h3>Manage Tests</h3>
                    <p>Create, edit, and manage test series.</p>
                </a>
            </div>
             <div class="action-card">
                <a href="#"> <!-- Link to new create test page -->
                    <h3>Create Test</h3>
                    <p>Generate new tests for the platform.</p>
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
                    <h3>Edit Questions</h3>
                    <p>Modify existing questions in the bank.</p>
                </a>
            </div>
             <div class="action-card">
                <a href="#"> 
                    <h3>Short Notes</h3>
                    <p>Manage educational short notes.</p>
                </a>
            </div>
            <div class="action-card">
                <a href="#"> 
                    <h3>Analytics</h3>
                    <p>View platform usage statistics.</p>
                </a>
            </div>
            <div class="action-card">
                <a href="#"> 
                    <h3>Payments</h3>
                    <p>Manage transactions and payment settings.</p>
                </a>
            </div>
             <div class="action-card">
                <a href="settings.php"> 
                    <h3>Platform Settings</h3>
                    <p>Configure site-wide settings.</p>
                </a>
            </div>
        </div>
    </main>
    <footer>
        <p>&copy; <?php echo date("Y"); ?> EduNexus. All rights reserved.</p>
    </footer>
</body>
</html>
