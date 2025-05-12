<?php
session_start();
if (!isset($_SESSION['user_email']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
    header('Location: ../auth/login.php?error=unauthorized');
    exit();
}
$adminName = $_SESSION['user_name'] ?? $_SESSION['user_email'];
// PHP logic to read test JSON files from ../data/test_pages/ and display them would go here.
// This is a conceptual placeholder.
$chapterwise_tests_dir = __DIR__ . '/../data/test_pages/chapterwise';
$full_length_tests_dir = __DIR__ . '/../data/test_pages/full_length';
$all_tests = [];

function scan_test_dir($dir, &$tests_array) {
    if (is_dir($dir)) {
        $files = scandir($dir);
        foreach ($files as $file) {
            if ($file !== '.' && $file !== '..' && pathinfo($file, PATHINFO_EXTENSION) === 'json') {
                $test_content = file_get_contents($dir . '/' . $file);
                $test_data = json_decode($test_content, true);
                if ($test_data) {
                    $tests_array[] = $test_data;
                }
            }
        }
    }
}

scan_test_dir($chapterwise_tests_dir, $all_tests);
scan_test_dir($full_length_tests_dir, $all_tests);

// Sort tests by creation date (descending) if createdAt exists
usort($all_tests, function($a, $b) {
    $timeA = isset($a['createdAt']) ? strtotime($a['createdAt']) : (isset($a['created']) ? strtotime($a['created']) : 0);
    $timeB = isset($b['createdAt']) ? strtotime($b['createdAt']) : (isset($b['created']) ? strtotime($b['created']) : 0);
    return $timeB - $timeA;
});

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manage Tests - EduNexus (Static)</title>
    <link rel="stylesheet" href="../css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <header>
        <h1>Manage Tests</h1>
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
            <h2 style="font-size: 1.8rem; margin:0; color: #3498db;">Test Management</h2>
            <a href="#" style="display: inline-block; padding: 0.7rem 1.3rem; background-color: #1abc9c; color: white; text-decoration: none; border-radius: 8px; font-weight:500;">Create New Test</a>
        </div>
        <p style="margin-bottom: 2rem; color: #7f8c8d;">Create, view, edit, and manage all test series on the platform.</p>
        
        <?php if (empty($all_tests)): ?>
            <p class="error-message" style="background-color: #fff9c4; color: #f57f17; border-color: #fff176;">No tests found in the system. <a href="#" style="color: #1abc9c; text-decoration:underline;">Create one now!</a></p>
        <?php else: ?>
            <table>
                <thead>
                    <tr>
                        <th>Test Code</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Subject(s)</th>
                        <th># Qs</th>
                        <th>Duration</th>
                        <th>Access</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($all_tests as $test): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($test['test_code'] ?? 'N/A'); ?></td>
                        <td><?php echo htmlspecialchars($test['name'] ?? 'N/A'); ?></td>
                        <td style="text-transform: capitalize;"><?php echo htmlspecialchars(str_replace('_', ' ', $test['testseriesType'] ?? ($test['testType'] ?? 'N/A'))); ?></td>
                        <td><?php echo htmlspecialchars(is_array($test['test_subject']) ? implode(', ', $test['test_subject']) : ($test['test_subject'] ?? 'N/A')); ?></td>
                        <td><?php echo htmlspecialchars($test['total_questions'] ?? ($test['count'] ?? 'N/A')); ?></td>
                        <td><?php echo htmlspecialchars($test['duration'] ?? 'N/A'); ?> mins</td>
                        <td>
                            <span style="padding: 3px 8px; border-radius: 5px; font-size: 0.8em; color: white; background-color: 
                                <?php 
                                    $type = strtoupper($test['type'] ?? 'FREE');
                                    if ($type === 'FREE') echo '#4caf50'; 
                                    else if ($type === 'PAID') echo '#f44336'; 
                                    else if ($type === 'FREE_PREMIUM') echo '#2196f3'; 
                                    else echo '#757575'; 
                                ?>;">
                                <?php echo htmlspecialchars($type); ?>
                            </span>
                        </td>
                        <td>
                            <a href="#" style="margin-right: 8px; color: #3498db; font-weight:500; font-size:0.85rem;">Edit</a>
                            <a href="#" style="color: #e53935; font-weight:500; font-size:0.85rem;">Delete</a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </main>
    <footer>
        <p>&copy; <?php echo date("Y"); ?> EduNexus. All rights reserved.</p>
    </footer>
</body>
</html>
