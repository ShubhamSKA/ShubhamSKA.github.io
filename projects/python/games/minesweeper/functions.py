from os import *
from random import *
from time import *

def checkneighbors(w,h,location,array,m):
    neighbors=[]
    x=((location-1)%w)
    y=int(((location-1)/w))
    #print(x,y)
    if x-1>=0 and y-1>=0 and (w*(y-1)+(x)+1) not in m:
        if count(w,h,array,x-1,y-1)==0:
            neighbors.append(w*(y-1)+(x-1)+1)
            #print(1)
    if y-1>=0 and (w*(y-1)+(x)+1) not in m:
        if count(w,h,array,x,y-1)==0:
            neighbors.append(w*(y-1)+(x)+1)
            #print(2)
    if y-1>=0 and x+1<w and (w*(y-1)+(x+1)+1) not in m:
        if count(w,h,array,x+1,y-1)==0:
            neighbors.append(w*(y-1)+(x+1)+1)
            #print(3)
    if x-1>=0 and (w*(y)+(x-1)+1) not in m:
        if count(w,h,array,x-1,y)==0:
            neighbors.append(w*(y)+(x-1)+1)
            #print(4)
    if x+1<w and (w*(y)+(x+1)+1) not in m:
        if count(w,h,array,x+1,y)==0:
            neighbors.append(w*(y)+(x+1)+1)
            #print(5)
    if y+1<h and x-1>=0 and (w*(y+1)+(x-1)+1) not in m:
        if count(w,h,array,x-1,y+1)==0:
            neighbors.append(w*(y+1)+(x-1)+1)
            #print(6)
    if y+1<h and (w*(y+1)+(x)+1) not in m:
        if count(w,h,array,x,y+1)==0:
            neighbors.append(w*(y+1)+(x)+1)
            #print(7)
    if y+1<h and x+1<w and (w*(y+1)+(x+1)+1) not in m:
        if count(w,h,array,x+1,y+1)==0:
            neighbors.append(w*(y+1)+(x+1)+1)  
    if (w*y+x+1) not in m:
        if count(w,h,array,x,y)==0:
            neighbors.append(w*y+x+1)
    return (neighbors)
def mineloc(w,h,m,x,y):
    array=[]
    while len(array)<m:
        num=randint(1,w*h)
        if num not in array and num!=x+w*y:
            array.append(num)
    return array
def innerarray(w,h,locs):
    array=[]
    for i in range(h):
        array.append([])
        for num in range(w):
            if h*i+num in locs:
                x=1
            else:
                x=0
            array[i].append(x)
    return array
def getCoor(w,h):
    x,y=0,0
    while x<=0 or x>w:
        x=(input("Enter the x-coordinate of the location you want to mark.\nIt must be between 1 and {}:\n".format(w)))
        if x.lower()=='end':
            system('cls')
            print("You have force ended the game.")
            exit()
        try:
            x=int(x)
        except:
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                         \033[A")
            print("That is an invalid input.")
            x=0
        if x<=0 or x>w:
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                         \033[A")
            print("That is an invalid input.")
    print ("\033[A                                                        \033[A")
    print ("\033[A                                                        \033[A")
    print ("\033[A                                                        \033[A")
    print("You have selected x to be {}\n".format(x))
    while y<=0 or y>h:
        try:
            y=int(input("Enter the y-coordinate of the location you want to mark.\nIt must be between 1 and {}:\n".format(h)))
        except:
            print('\n\n')
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                         \033[A")
            print("That is an invalid input.")
            y=0
        if y<=0 or y>h:
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                        \033[A")
            print ("\033[A                                                         \033[A")
            print("That is an invalid input.")
    
    system('cls')
    print("You have selected x to be {}\nYou have selected y to be {}".format(x,y))
    return(x,y)
def geninit(w,h):
    array=[]
    row=[]
    for i in range(w):
        row.append("▣")
    for i in range(h):
        array.append(row)
    return array
def outerarray(w,h,oar,iar,x,y,game,m,turns):
    #while game!='end':
        printOuter(oar)
        if turns==0:
            iar=innerarray(w,h,m)
        if turns!=0:
            coordinates=getCoor(w,h)
            x=coordinates[0]
            y=coordinates[1]
        if iar[y-1][x-1]==1:
            game='end'
            return(game,iar)
        else:
            loc=w*(y-1)+(x-1)+1
            zero=turn0(w,h,loc,iar,m)
            revealed=turn(zero,w,h)
            revealed.append(loc) 
            for location in revealed:
                x1=((location-1)%w)
                y1=int(((location-1)/w))
                row=[]
                for i in range(len(oar[y1])):
                    row.append(oar[y1][i])
                del row[x1]
                row.insert(x1,count(w,h,iar,x1,y1))
                del oar[y1]
                oar.insert(y1,row)
            printOuter(oar)
            if totaluncovered(oar)>len(m):
                oar=(outerarray(w,h,oar,iar,x,y,0,m,1))[0]
            return(oar,game,iar)
def count(w,h,array,x,y):
    total=0
    if x-1>=0 and y-1>=0:
        total+= array[y-1][x-1]
    if y-1>=0:
        total+= array[y-1][x]
    if y-1>=0 and x+1<w:
        total+= array[y-1][x+1]
    if x-1>=0:
        total+= array[y][x-1]
    if x+1<w:
        total+= array[y][x+1]
    if y+1<h and x-1>=0:
        total+= array[y+1][x-1]
    if y+1<h:
        total+= array[y+1][x]
    if y+1<h and x+1<w:
        total+= array[y+1][x+1]
    total+=array[y][x]
    return total
def printOuter(array):
    system('cls')
    for i in array:
        print('')
        for elem in i:
            if elem==0:
                print("◻", end=' ')
            else:
                print(elem,end=' ')
    print('\n\n')
def getBoard():
    system('cls')
    level= input("Input the desired game level [Easy, Medium, Hard, Insane, Custom]:\n")
    level=level.lower()
    while level not in ["easy", "medium", "hard", "insane","custom"]:
        system('cls')
        print("That is not one of the possible difficulties.")
        level= input("Please, input the desired game level [Easy, Medium, Hard, Insane, Custom]:\n")
        level=level.lower()

    if level == "easy":
        height=10
        width=10
        mines=10
    elif level=='medium':
        height=16
        width=16
        mines=40
    elif level=='hard':
        height=16
        width=30
        mines=99;
    elif level=='insane':
        height=25
        width=30
        mines=300
    elif level=='custom':
        sleep(0.5)
        system('cls')
        print("You have chosen the custom board.")
        sleep(0.2)
        print("You will now be asked to input the height, width and number of mines in your game.\n\n")
        sleep(0.2)
        try:
            height=int(input("Enter the height of your board:\n"))
        except:
            height=0
        while height <= 0:
            print ("\033[A                                  \033[A")
            print ("\033[A                                  \033[A")
            print ("\033[A                                  \033[A")
            print("That is an invalid height.")
            try:
                height=int(input("Enter the height of your board:\n"))
            except:
                height=0
        try:
            width=int(input("\nEnter the width of your board:\n"))
        except:
            width=0
        while width <= 0:
            print("")
            print ("\033[A                                 \033[A")
            print ("\033[A                                 \033[A")
            print ("\033[A                                  \033[A")
            print ("\033[A                                  \033[A")
            print("That is an invalid width.")
            try:
                width=int(input("Enter the width of your board:\n"))    
            except:
                width=0
        try:
            mines=int(input("\nEnter the number of mines on your board:\n"))
        except:
            mines=-2
        while mines < 0 or mines>(width*height-1):
            print("")
            print ("\033[A                                 \033[A")
            print ("\033[A                                 \033[A")
            print ("\033[A                                  \033[A")
            print ("\033[A                                  \033[A")
            print("That is an invalid number of mines.")
            try:
                mines=int(input("Enter the number of mines on your board:\n"))
            except:
                mines=-2
    
    return(level,width,height,mines)
def end(game,iar,starttime):
    if game=='end':
        print("The game has ended.\nYou have lost.\nTry again another time.")
        for i in iar:
            print("")
            for area in i:
                if area==1:
                    print("⧆",end=" ")
                    sleep(5/(len(iar)*len(iar[1])))
                else:
                    print("□",end=" ")
                    sleep(3/(len(iar)*len(iar[1])))
        print('\n')
        endtime=time()
        print("You lost this game in {:.2f} seconds!".format(endtime-starttime))
    else:
        system('cls')
        print("Congratulations! You won!")
        endtime=time()
        print("You won this game in {:.2f} seconds!".format(endtime-starttime))
def genintinit(w,h):
    array=[]
    row=[]
    for i in range(w):
        row.append(0)
    for i in range(h):
        array.append(row)
    return array
def union(list1,list2):
    united=[]
    for i in list1:
        if i not in united:
            united.append(i)
    for i in list2:
        if i not in united:
            united.append(i)
    return united
def turn0(w,h,location,array,m):
    og=checkneighbors(w,h,location,array,m)
    og2=[]
    while og2!=og:
        og2=union(og,og2)
        for i in og:
            sub=checkneighbors(w,h,i,array,m)
            og=union(og,sub)
    og=sorted(og)
    return og
def neighborlist(location,w,h):
    neighbors=[]
    x=((location-1)%w)
    y=int(((location-1)/w))
    if x-1>=0 and y-1>=0:
        neighbors.append(w*(y-1)+(x-1)+1)
    if y-1>=0:
        neighbors.append(w*(y-1)+(x)+1)
    if y-1>=0 and x+1<w:
        neighbors.append(w*(y-1)+(x+1)+1)
    if x-1>=0:
        neighbors.append(w*(y)+(x-1)+1)
    if x+1<w:
        neighbors.append(w*(y)+(x+1)+1)
    if y+1<h and x-1>=0:
        neighbors.append(w*(y+1)+(x-1)+1)
    if y+1<h:
        neighbors.append(w*(y+1)+(x)+1)
    if y+1<h and x+1<w:
        neighbors.append(w*(y+1)+(x+1)+1)
    return (neighbors)
def turn(zeros,w,h):
    final=[]
    for i in zeros:
        final=union(final,neighborlist(i,w,h))
    final=sorted(final)
    return final
def totaluncovered(array):
    count=0
    for row in array:
        for element in row:
            if element=="▣":
                count+=1
    return(count)

