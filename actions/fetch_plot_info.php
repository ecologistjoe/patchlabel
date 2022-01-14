<?php
    include('login.php');
    
    $PATH_TO_JSON = "/home/patchlabelstorage";
    
    $plot_id = intval($_GET['plot_id']);
    $user_id = intval($_SESSION['user_id']);

    $rs = $mysqli->query("SELECT * FROM plots WHERE plot_id = $plot_id") or die($mysqli->error);
    $r = $rs->fetch_assoc();
    if($r){
        $patches = json_decode(file_get_contents("$PATH_TO_JSON/prj_$r[project_id]/patches.json"), true);
        $_R['dist_year'] = $r['dist_year'];
        if(array_key_exists($r['tsa'], $patches)) {
            if(array_key_exists($r['patchinfo_id'], $patches[$r['tsa']])) {
                $_R['patch'] = $patches[$r['tsa']][$r['patchinfo_id']];
            }
        }
        if(! isset($_R['patch'])) {
            $_R['patch'] = "[$r[lng],$r[lat]]";
        }

        $rs = $mysqli->query("SELECT * FROM interpretations as i
                WHERE i.plot_id = $plot_id AND i.user_id = $user_id
                ") or die($mysqli->error);
        $r = $rs->fetch_assoc();
        if($r) $_R = array_merge($_R, $r);
        
        echo JSON_encode($_R);    

    } else {
        echo '{"error":"Plot not found"}';
    }
?>