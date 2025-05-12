<?php
session_start();
if (!isset($_SESSION['user_email']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
    header('Location: ../auth/login.php?error=unauthorized');
    exit();
}

$adminName = $_SESSION['user_name'] ?? $_SESSION['user_email'];
$users_file_path = __DIR__ . '/../data/users.json';
$users_array = [];

if (file_exists($users_file_path)) {
    $users_data_json = file_get_contents($users_file_path);
    $users_array = json_decode($users_data_json, true);
    if (!is_array($users_array)) {
        $users_array = []; // Ensure it's an array even if file is invalid/empty
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manage Users - EduNexus (Static)</title>
    <link rel="stylesheet" href="../css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">

</head>
<body>
    <header>
        <h1>Manage Users</h1>
         <nav class="admin-nav">
            <a href="dashboard.php">Dashboard</a>
            <a href="users.php">Users</a>
            <a href="tests.php">Tests</a>
            <a href="settings.php">Settings</a>
            <a href="../auth/logout.php">Logout (<?php echo htmlspecialchars($adminName); ?>)</a>
        </nav>
    </header>
    <main style="padding: 2rem;" class="admin-main-content">
         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2 style="font-size: 1.8rem; margin:0; color: #3498db;">User Accounts</h2>
            <!-- Placeholder for Add User button -->
            <a href="#" style="display: inline-block; padding: 0.7rem 1.3rem; background-color: #1abc9c; color: white; text-decoration: none; border-radius: 8px; font-weight:500;">Add New User</a>
        </div>
        <p style="margin-bottom: 2rem; color: #7f8c8d;">View and manage all registered user accounts on the platform.</p>

        <?php if (empty($users_array)): ?>
            <p class="error-message" style="background-color: #fff9c4; color: #f57f17; border-color: #fff176;">No users found in the system.</p>
        <?php else: ?>
            <div style="overflow-x:auto;"> <!-- For responsiveness -->
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Class</th>
                        <th>Model</th>
                        <th>Target Year</th>
                        <th>Expiry Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users_array as $user_item): ?>
                        <tr>
                            <td style="font-size:0.8em; color: #7f8c8d;"><?php echo htmlspecialchars($user_item['id'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($user_item['name'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($user_item['email'] ?? 'N/A'); ?></td>
                            <td>
                                <span style="padding: 3px 8px; border-radius: 5px; font-size: 0.8em; color: white; background-color: <?php echo ($user_item['role'] ?? 'User') === 'Admin' ? '#c0392b' : '#27ae60'; ?>;">
                                    <?php echo htmlspecialchars($user_item['role'] ?? 'User'); ?>
                                </span>
                            </td>
                            <td><?php echo htmlspecialchars($user_item['class'] ?? 'N/A'); ?></td>
                            <td style="text-transform: capitalize;"><?php echo htmlspecialchars($user_item['model'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($user_item['targetYear'] ?? 'N/A'); ?></td>
                            <td><?php echo isset($user_item['expiry_date']) ? htmlspecialchars(date("d M Y", strtotime($user_item['expiry_date']))) : 'N/A'; ?></td>
                            <td>
                                <a href="#" style="margin-right: 8px; color: #3498db; font-weight:500; font-size:0.85rem;">Edit</a>
                                <a href="#" style="color: #e53935; font-weight:500; font-size:0.85rem;">Delete</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            </div>
        <?php endif; ?>
    </main>
    <footer>
        <p>&copy; <?php echo date("Y"); ?> EduNexus. All rights reserved.</p>
    </footer>
</body>
</html>
