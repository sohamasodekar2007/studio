<?php
session_start();
if (!isset($_SESSION['user_email']) || $_SESSION['user_role'] !== 'Admin') {
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
</head>
<body>
    <header>
        <h1>Manage Users</h1>
         <nav class="admin-nav">
            <a href="dashboard.php">Dashboard</a>
            <a href="users.php">Manage Users</a>
            <a href="tests.php">Manage Tests</a>
            <a href="../auth/logout.php">Logout (<?php echo htmlspecialchars($adminName); ?>)</a>
        </nav>
    </header>
    <main style="padding: 2rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">User Accounts</h2>
        <p style="margin-bottom: 1.5rem;">View and manage all registered user accounts.</p>

        <?php if (empty($users_array)): ?>
            <p>No users found in the system.</p>
        <?php else: ?>
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
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users_array as $user_item): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($user_item['id'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($user_item['name'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($user_item['email'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($user_item['role'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($user_item['class'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($user_item['model'] ?? 'N/A'); ?></td>
                            <td><?php echo htmlspecialchars($user_item['targetYear'] ?? 'N/A'); ?></td>
                            <td>
                                <a href="#" style="margin-right: 5px; color: #5e35b1;">Edit</a>
                                <a href="#" style="color: #e53935;">Delete</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </main>
    <footer>
        <p>&copy; <?php echo date("Y"); ?> EduNexus</p>
    </footer>
</body>
</html>
