-- Demonstration catalog only. All live room availability starts Unknown.
insert into roomly_private.universities(id,name) values
('cbs','CBS International Business School');
insert into roomly_private.campuses(id,university_id,name) values
('main','cbs','Main Campus');
insert into roomly_private.buildings(id,campus_id,name) values
('main-building','main','Main Building');
insert into roomly_private.floors(id,building_id,number) values
('floor-0','main-building','0'),
('floor-1','main-building','1'),
('floor-2','main-building','2'),
('floor-3','main-building','3'),
('floor-4','main-building','4');
insert into roomly_private.rooms(id,floor_id,capacity) values
('lounge','floor-0','12'),
('reading','floor-0','4'),
('112','floor-1','6'),
('114','floor-1','4'),
('118','floor-1','2'),
('203','floor-2','6'),
('214','floor-2','6'),
('216','floor-2','8'),
('301','floor-3','4'),
('302','floor-3','2'),
('303','floor-3','6'),
('321','floor-3','4'),
('demo-0-40','floor-0','6'),
('demo-0-41','floor-0','2'),
('demo-0-42','floor-0','10'),
('demo-1-40','floor-1','6'),
('demo-1-41','floor-1','2'),
('demo-1-42','floor-1','10'),
('demo-2-40','floor-2','6'),
('demo-2-41','floor-2','2'),
('demo-2-42','floor-2','10'),
('demo-3-40','floor-3','6'),
('demo-3-41','floor-3','2'),
('demo-3-42','floor-3','10'),
('demo-4-40','floor-4','6'),
('demo-4-41','floor-4','2'),
('demo-4-42','floor-4','10');
