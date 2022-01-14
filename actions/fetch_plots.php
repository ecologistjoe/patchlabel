<?php
    include('login.php');
    
    $user_id = $mysqli->real_escape_string($_SESSION['user_id']);
    $project_id = $mysqli->real_escape_string($_GET['project_id']);
    
    $rs = $mysqli->query("
                SELECT p.plot_id, p.tsa, p.patchinfo_id, i.iscomplete FROM 
                    plots as p
                    INNER JOIN assignments as a
                        ON p.project_id = a.project_id AND p.tsa = a.tsa
                    LEFT JOIN interpretations as i
                        ON p.plot_id = i.plot_id AND a.user_id = i.user_id 
                WHERE a.user_id = $user_id
                    AND p.project_id = $project_id
                    AND a.status = 1
                ORDER BY p.tsa, p.patchinfo_id
                ") or die($mysqli->error);
    
    $plots = [];
    while($r=$rs->fetch_assoc()) {
        # necessary because the outer join creates nulls
        $r['iscomplete'] = $r['iscomplete'] ? 1 : 0;
        $plots[] = $r;
    }
    
    echo JSON_encode($plots);
?>