#Requires AutoHotkey v2.0

#y::
{
    Run "https://www.youtube.com"
}

^+p::
{
    SendText "Has this song been commercially released? Is it in the public domain? Is it royalty-free? Answer only yes or no."
    Send "{Enter}"

}