<?php
    include('login.php');
    
    $user_id = $mysqli->real_escape_string($_SESSION['user_id']);
    $rs = $mysqli->query("SELECT DISTINCT p.project_id, p.project_code
                        FROM assignments as a, projects as p
                        WHERE p.project_id = a.project_id 
                            AND a.status =1 
                            AND a.user_id = $user_id
                        ") or die($mysqli->error);
                    
    $projects = [];
    while($r=$rs->fetch_assoc()) {
        $projects[] = $r;
    }
    
    echo JSON_encode($projects);
?>